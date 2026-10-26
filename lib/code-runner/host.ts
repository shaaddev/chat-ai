import type { Runner } from "./languages";
import {
  type FrameMessage,
  HOST_BACKSTOP_MARGIN_MS,
  type HostMessage,
  LOAD_TIMEOUT_MS,
  READY_TIMEOUT_MS,
  RUN_TIMEOUT_MS,
  randomId,
  readFrameMessage,
} from "./protocol";
import type { RunEvent, RunExit } from "./run-state";

interface ActiveRun {
  deadline: ReturnType<typeof setTimeout>;
  readonly emit: (event: RunEvent) => void;
}

interface Sandbox {
  readonly iframe: HTMLIFrameElement;
  readonly outbox: HostMessage[];
  ready: boolean;
  readonly readyDeadline: ReturnType<typeof setTimeout>;
  readonly runs: Map<string, ActiveRun>;
}

type SandboxDocument = typeof import("./sandbox-document");

let sandbox: Sandbox | null = null;
let sandboxModule: Promise<SandboxDocument> | null = null;

const exitEvent = (exit: RunExit, detail: string | null): RunEvent => ({
  type: "exit",
  exit,
  at: performance.now(),
  detail,
});

function loadSandboxModule(): Promise<SandboxDocument> {
  sandboxModule ??= import("./sandbox-document").catch((error: unknown) => {
    sandboxModule = null;
    throw error;
  });
  return sandboxModule;
}

function openSandbox({ sandboxDocument }: SandboxDocument): Sandbox {
  if (sandbox) {
    return sandbox;
  }
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.hidden = true;
  iframe.title = "Code runner";
  iframe.srcdoc = sandboxDocument({
    nonce: randomId(),
    parentOrigin: window.location.origin,
  });
  const opened: Sandbox = {
    iframe,
    outbox: [],
    ready: false,
    readyDeadline: setTimeout(closeSandbox, READY_TIMEOUT_MS),
    runs: new Map(),
  };
  sandbox = opened;
  window.addEventListener("message", onMessage);
  document.body.append(iframe);
  return opened;
}

function closeSandbox(): void {
  const closing = sandbox;
  if (!closing) {
    return;
  }
  sandbox = null;
  clearTimeout(closing.readyDeadline);
  window.removeEventListener("message", onMessage);
  closing.iframe.remove();
  for (const run of closing.runs.values()) {
    clearTimeout(run.deadline);
    run.emit(exitEvent("timed-out", "The sandbox stopped responding."));
  }
}

function post(target: Sandbox, message: HostMessage): void {
  if (target.ready) {
    // An opaque-origin frame can only be addressed with "*".
    target.iframe.contentWindow?.postMessage(message, "*");
  } else {
    target.outbox.push(message);
  }
}

function arm(run: ActiveRun, ms: number): void {
  clearTimeout(run.deadline);
  run.deadline = setTimeout(closeSandbox, ms + HOST_BACKSTOP_MARGIN_MS);
}

function deliver(
  current: Sandbox,
  message: Exclude<FrameMessage, { type: "ready" }>
): void {
  const run = current.runs.get(message.runId);
  if (!run) {
    return;
  }
  switch (message.type) {
    case "loading":
      arm(run, LOAD_TIMEOUT_MS);
      run.emit({ type: "loading" });
      return;
    case "started":
      arm(run, RUN_TIMEOUT_MS);
      run.emit({ type: "started", at: performance.now() });
      return;
    case "output":
      run.emit({ type: "output", chunks: message.chunks });
      return;
    case "exit":
      clearTimeout(run.deadline);
      current.runs.delete(message.runId);
      run.emit(exitEvent(message.exit, message.detail));
      return;
    default:
      return;
  }
}

function onMessage(event: MessageEvent): void {
  const current = sandbox;
  if (!current) {
    return;
  }
  const message = readFrameMessage(event, {
    frame: current.iframe.contentWindow,
    isActiveRun: (runId) => current.runs.has(runId),
  });
  if (message?.type === "ready") {
    current.ready = true;
    clearTimeout(current.readyDeadline);
    for (const queued of current.outbox.splice(0)) {
      post(current, queued);
    }
  } else if (message) {
    deliver(current, message);
  }
}

async function compile(runner: Runner, source: string): Promise<string> {
  if (runner.transpile !== "typescript") {
    return source;
  }
  const { transform } = await import("sucrase");
  return transform(source, {
    transforms: ["typescript"],
    disableESTransforms: true,
  }).code;
}

export function startRun(
  runner: Runner,
  source: string,
  onEvent: (event: RunEvent) => void
): () => void {
  const runId = randomId();
  let settled = false;
  const emit = (event: RunEvent) => {
    if (settled) {
      return;
    }
    settled = event.type === "exit";
    onEvent(event);
  };

  const launch = async () => {
    const [code, module] = await Promise.all([
      compile(runner, source),
      loadSandboxModule(),
    ]);
    if (settled) {
      return;
    }
    const target = openSandbox(module);
    target.runs.set(runId, {
      emit,
      deadline: setTimeout(
        closeSandbox,
        LOAD_TIMEOUT_MS + HOST_BACKSTOP_MARGIN_MS
      ),
    });
    post(target, { type: "run", runId, runtime: runner.runtime, code });
  };
  launch().catch((error: unknown) => {
    emit(
      exitEvent(
        "error",
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error)
      )
    );
  });

  return () => {
    const target = sandbox;
    const run = target?.runs.get(runId);
    if (target && run) {
      clearTimeout(run.deadline);
      target.runs.delete(runId);
      const queued = target.outbox.findIndex(
        (message) => message.runId === runId
      );
      if (queued === -1) {
        post(target, { type: "stop", runId });
      } else {
        target.outbox.splice(queued, 1);
      }
    }
    emit(exitEvent("stopped", null));
  };
}
