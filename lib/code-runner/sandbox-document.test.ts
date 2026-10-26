/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  LOAD_TIMEOUT_MS,
  OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL,
  PYODIDE_URL,
  RUN_TIMEOUT_MS,
} from "./protocol";
import { DETAIL_LIMIT } from "./run-state";
import {
  sandboxDocument,
  sandboxPolicy,
  WORKER_SCRIPT,
} from "./sandbox-document";

const WHITESPACE = /\s+/;
const PINNED_PYODIDE =
  /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v\d+\.\d+\.\d+\/full\/$/;
const SCRIPT_TAG = /<script\b[^>]*>/g;
const SCRIPT_END = /<\/script>/g;
const PARENT_ORIGIN = "https://chat.example";
const HTML = sandboxDocument({ nonce: "abc123", parentOrigin: PARENT_ORIGIN });
const FRAME_SCRIPT = HTML.slice(
  HTML.indexOf(">", HTML.indexOf("<script")) + 1,
  HTML.indexOf("</script>")
);

const directives = (policy: string) =>
  new Map(
    policy.split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(WHITESPACE);
      return [name, sources] as const;
    })
  );

describe("sandbox policy", () => {
  const policy = directives(sandboxPolicy("abc123"));

  test("denies everything it does not name", () => {
    expect(policy.get("default-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'none'"]);
    expect(policy.get("form-action")).toEqual(["'none'"]);
  });

  test("allows network access only to the pinned Pyodide release", () => {
    expect(PYODIDE_URL).toMatch(PINNED_PYODIDE);
    expect(policy.get("connect-src")).toEqual([PYODIDE_URL]);
  });

  test("runs only the nonced bootstrap and code the frame holds in memory", () => {
    const scripts = policy.get("script-src") ?? [];
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("blob:");
    for (const source of [
      "'self'",
      "'unsafe-inline'",
      "*",
      "https:",
      "data:",
    ]) {
      expect(scripts).not.toContain(source);
    }
    expect(scripts.some((source) => source.startsWith("http"))).toBe(false);
    expect(policy.get("worker-src")).toEqual(["blob:"]);
  });

  test("applies the policy before its only script runs", () => {
    const policyAt = HTML.indexOf('http-equiv="Content-Security-Policy"');
    expect(policyAt).toBeGreaterThan(-1);
    expect(policyAt).toBeLessThan(HTML.indexOf("<script"));
    expect(HTML.match(SCRIPT_TAG)).toEqual(['<script nonce="abc123">']);
    expect(HTML.match(SCRIPT_END)).toHaveLength(1);
  });
});

type Message = Record<string, unknown>;

class FakeWorker {
  received: Message[] = [];
  terminated = false;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: { message: string; preventDefault: () => void }) => void;
  postMessage(message: Message) {
    this.received.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
  crash(message: string) {
    this.onerror?.({ message, preventDefault: () => undefined });
  }
}

class Clock {
  now = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { at: number; run: () => void }>();
  setTimeout = (run: () => void, ms = 0) => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { at: this.now + ms, run });
    return id;
  };
  clearTimeout = (id: number) => {
    this.timers.delete(id);
  };
  advance(ms: number) {
    const until = this.now + ms;
    for (;;) {
      const [next] = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= until)
        .sort(([, a], [, b]) => a.at - b.at);
      if (!next) {
        break;
      }
      this.timers.delete(next[0]);
      this.now = next[1].at;
      next[1].run();
    }
    this.now = until;
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

function loadFrame(
  options: {
    fetch?: (url: string) => Promise<Response>;
    workerFails?: boolean;
  } = {}
) {
  const sent: Message[] = [];
  const workers: FakeWorker[] = [];
  const fetched: string[] = [];
  const clock = new Clock();
  let listener: ((event: unknown) => void) | undefined;
  const parentWindow = {
    postMessage: (message: Message, origin: string) => {
      expect(origin).toBe(PARENT_ORIGIN);
      sent.push(message);
    },
  };
  class TestWorker extends FakeWorker {
    constructor() {
      super();
      if (options.workerFails) {
        throw new Error("workers are unavailable");
      }
      workers.push(this);
    }
  }
  const fetchAsset =
    options.fetch ??
    ((url: string) =>
      Promise.resolve(
        new Response(url.endsWith(".json") ? "{}" : new Uint8Array([1, 2, 3]))
      ));
  new Function(
    "parent",
    "addEventListener",
    "Worker",
    "setTimeout",
    "clearTimeout",
    "fetch",
    FRAME_SCRIPT
  )(
    parentWindow,
    (type: string, handler: (event: unknown) => void) => {
      if (type === "message") {
        listener = handler;
      }
    },
    TestWorker,
    clock.setTimeout,
    clock.clearTimeout,
    (url: string) => {
      fetched.push(url);
      return fetchAsset(url);
    }
  );
  const fromApp = (
    data: Message,
    from: { source?: unknown; origin?: string } = {}
  ) =>
    listener?.({
      source: from.source ?? parentWindow,
      origin: from.origin ?? PARENT_ORIGIN,
      data,
    });
  const run = (runId: string, runtime: string, code = "code") =>
    fromApp({ type: "run", runId, runtime, code });
  const of = (runId: string) => sent.filter((m) => m.runId === runId);
  return { sent, workers, fetched, clock, fromApp, run, of };
}

describe("sandbox frame", () => {
  test("announces itself and ignores other windows and origins", () => {
    const frame = loadFrame();
    expect(frame.sent).toEqual([{ type: "ready" }]);
    frame.fromApp(
      { type: "run", runId: "a", runtime: "javascript", code: "" },
      { source: {} }
    );
    frame.fromApp(
      { type: "run", runId: "b", runtime: "javascript", code: "" },
      { origin: "https://evil.example" }
    );
    expect(frame.workers).toHaveLength(0);
  });

  test("runs JavaScript in a fresh worker and batches its output", () => {
    const frame = loadFrame();
    frame.run("a", "javascript", "console.log(1)");
    const [worker] = frame.workers;
    expect(worker.received).toEqual([
      { type: "run", runtime: "javascript", code: "console.log(1)" },
    ]);
    worker.emit({ type: "output", stream: "stdout", text: "1\n" });
    worker.emit({ type: "output", stream: "stdout", text: "2\n" });
    worker.emit({ type: "output", stream: "stderr", text: "e\n" });
    expect(frame.of("a")).toEqual([{ type: "started", runId: "a" }]);
    frame.clock.advance(50);
    worker.emit({ type: "exit", exit: "done", detail: null });
    expect(frame.of("a")).toEqual([
      { type: "started", runId: "a" },
      {
        type: "output",
        runId: "a",
        chunks: [
          { stream: "stdout", text: "1\n2\n" },
          { stream: "stderr", text: "e\n" },
        ],
      },
      { type: "exit", runId: "a", exit: "done", detail: null },
    ]);
    expect(worker.terminated).toBe(true);
  });

  test("sends what a hung program printed before it times out", () => {
    const frame = loadFrame();
    frame.run("a", "javascript");
    frame.workers[0].emit({
      type: "output",
      stream: "stdout",
      text: "start\n",
    });
    frame.clock.advance(RUN_TIMEOUT_MS);
    expect(frame.of("a").slice(1)).toEqual([
      {
        type: "output",
        runId: "a",
        chunks: [{ stream: "stdout", text: "start\n" }],
      },
      { type: "exit", runId: "a", exit: "timed-out", detail: null },
    ]);
    expect(frame.workers[0].terminated).toBe(true);
  });

  test("accepts output up to the budget", () => {
    const frame = loadFrame();
    frame.run("a", "javascript");
    frame.workers[0].emit({
      type: "output",
      stream: "stdout",
      text: "x".repeat(OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL),
    });
    expect(frame.workers[0].terminated).toBe(false);
  });

  test.each([
    ["a string", "hello"],
    ["empty text", { type: "output", stream: "stdout", text: "" }],
    ["an unknown stream", { type: "output", stream: "stdin", text: "x" }],
    [
      "text past the budget",
      {
        type: "output",
        stream: "stdout",
        text: "x".repeat(OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL + 1),
      },
    ],
    ["a stop the worker cannot claim", { type: "exit", exit: "stopped" }],
    ["a forged ready", { type: "ready" }],
  ])("ends a run whose worker sends %s", (_, data) => {
    const frame = loadFrame();
    frame.run("a", "javascript");
    frame.workers[0].emit(data);
    expect(frame.of("a").at(-1)).toEqual({
      type: "exit",
      runId: "a",
      exit: "error",
      detail: "The program sent a message the runner does not accept.",
    });
    expect(frame.workers[0].terminated).toBe(true);
  });

  test("stop terminates the worker without reporting an exit", () => {
    const frame = loadFrame();
    frame.run("a", "javascript");
    frame.workers[0].emit({ type: "output", stream: "stdout", text: "x" });
    frame.fromApp({ type: "stop", runId: "a" });
    frame.clock.advance(RUN_TIMEOUT_MS);
    expect(frame.of("a")).toEqual([{ type: "started", runId: "a" }]);
    expect(frame.workers[0].terminated).toBe(true);
  });

  test("a worker crash ends its run with the reason", () => {
    const frame = loadFrame();
    frame.run("a", "javascript");
    frame.workers[0].crash("Out of memory");
    expect(frame.of("a").at(-1)).toEqual({
      type: "exit",
      runId: "a",
      exit: "error",
      detail: "Out of memory",
    });
  });

  test("a run the frame cannot start ends with the reason", () => {
    const frame = loadFrame({ workerFails: true });
    frame.run("a", "javascript");
    expect(frame.of("a")).toEqual([
      {
        type: "exit",
        runId: "a",
        exit: "error",
        detail: "Could not start the run. workers are unavailable",
      },
    ]);
  });

  test("downloads Pyodide once and gives every Python run a fresh worker", async () => {
    const frame = loadFrame();
    frame.run("p1", "python", "print(1)");
    expect(frame.of("p1")).toEqual([{ type: "loading", runId: "p1" }]);
    await settle();
    expect(frame.fetched).toHaveLength(5);
    const [first] = frame.workers;
    expect(first.received[0]).toMatchObject({
      type: "boot",
      indexURL: PYODIDE_URL,
    });

    first.emit({ type: "ready" });
    expect(first.received[1]).toEqual({
      type: "run",
      runtime: "python",
      code: "print(1)",
    });
    expect(frame.of("p1").at(-1)).toEqual({ type: "started", runId: "p1" });
    expect(frame.workers).toHaveLength(2);
    first.emit({ type: "exit", exit: "done", detail: null });
    expect(first.terminated).toBe(true);

    await settle();
    const [, spare] = frame.workers;
    spare.emit({ type: "ready" });
    frame.run("p2", "python", "print(2)");
    expect(frame.of("p2")).toEqual([{ type: "started", runId: "p2" }]);
    expect(spare.received.at(-1)).toEqual({
      type: "run",
      runtime: "python",
      code: "print(2)",
    });
    await settle();
    expect(frame.workers).toHaveLength(3);
    expect(frame.fetched).toHaveLength(5);
  });

  test("a failed Pyodide download fails the waiting run and retries next time", async () => {
    const frame = loadFrame({
      fetch: () => Promise.reject(new Error("offline")),
    });
    frame.run("p1", "python");
    await settle();
    expect(frame.of("p1").at(-1)).toEqual({
      type: "exit",
      runId: "p1",
      exit: "error",
      detail: "Could not load Python. offline",
    });
    expect(frame.workers[0].terminated).toBe(true);
    frame.run("p2", "python");
    await settle();
    expect(frame.fetched).toHaveLength(10);
  });

  test("a Python worker that never boots times out the waiting run", async () => {
    const frame = loadFrame();
    frame.run("p1", "python");
    await settle();
    frame.clock.advance(LOAD_TIMEOUT_MS);
    expect(frame.of("p1").at(-1)).toEqual({
      type: "exit",
      runId: "p1",
      exit: "error",
      detail: "Python took too long to load.",
    });
    expect(frame.workers[0].terminated).toBe(true);
  });
});

type TaskOrder = "timer first" | "rejection first";

// HTML reports an unhandled rejection in a task from a different source than
// timers, and a browser may run either source first. Chromium runs the timer.
// Bun's Worker never fires unhandledrejection, so the worker script runs in a
// child process whose timers and rejection reports are explicit queues.
const workerProcess = (code: string, order: TaskOrder) => `
const { writeSync } = require("node:fs");
const TIMER_FIRST = ${order === "timer first"};
const realSetTimeout = setTimeout;
const listeners = new Map();
const timers = new Map();
const reports = [];
let now = 0;
let nextId = 1;
let scheduled = false;
globalThis.postMessage = (message) => {
  writeSync(1, JSON.stringify(message) + "\\n");
  if (message.type === "exit") process.exit(0);
};
globalThis.addEventListener = (type, handler) => listeners.set(type, handler);
globalThis.setTimeout = (callback, delay = 0, ...args) => {
  const id = nextId++;
  timers.set(id, { at: now + delay, run: () => callback(...args) });
  schedule();
  return id;
};
globalThis.setInterval = (callback, delay = 0, ...args) => {
  const id = nextId++;
  const arm = () => timers.set(id, { at: now + Math.max(1, delay), run: () => { arm(); callback(...args); } });
  arm();
  schedule();
  return id;
};
globalThis.clearTimeout = globalThis.clearInterval = (id) => timers.delete(id);
process.on("unhandledRejection", (reason) => {
  reports.push(() => listeners.get("unhandledrejection")({ reason, preventDefault() {}, stopImmediatePropagation() {} }));
  schedule();
});
function nextTimer() {
  let next = null;
  for (const entry of timers) if (!next || entry[1].at < next[1].at) next = entry;
  if (!next) return null;
  timers.delete(next[0]);
  now = Math.max(now, next[1].at);
  return next[1].run;
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  realSetTimeout(step, 1);
}
function step() {
  scheduled = false;
  const task = TIMER_FIRST ? nextTimer() ?? reports.shift() : reports.shift() ?? nextTimer();
  if (!task) return;
  try {
    task();
  } finally {
    schedule();
  }
}
${WORKER_SCRIPT}
listeners.get("message")({ data: { type: "run", runtime: "javascript", code: ${JSON.stringify(code)} } });
`;

function runInWorker(
  code: string,
  {
    order = "timer first",
    waitMs = 2000,
  }: { order?: TaskOrder; waitMs?: number } = {}
) {
  const child = spawnSync(
    process.execPath,
    ["--eval", workerProcess(code, order)],
    { encoding: "utf8", timeout: waitMs }
  );
  const messages: Message[] = child.stdout
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
  const text = (stream: string) =>
    messages
      .filter((m) => m.type === "output" && m.stream === stream)
      .map((m) => m.text)
      .join("");
  return {
    stdout: text("stdout"),
    stderr: text("stderr"),
    exit: messages.find((m) => m.type === "exit"),
  };
}

describe("sandbox worker", () => {
  test("formats console output the way Node does", () => {
    const { stdout, stderr, exit } = runInWorker(
      `console.log(1, "a", { name: "Ada", langs: ["js"] }, [1, [2, [3, [4]]]], new Map([["k", 1]]), new Set([1]), null, undefined, 10n);
console.log("%s has %d items", "cart", 3);
console.error("careful");`
    );
    expect(stdout).toBe(
      "1 a { name: 'Ada', langs: [ 'js' ] } [ 1, [ 2, [ 3, [Array] ] ] ] Map(1) { 'k' => 1 } Set(1) { 1 } null undefined 10n\ncart has 3 items\n"
    );
    expect(stderr).toBe("careful\n");
    expect(exit).toEqual({ type: "exit", exit: "done", detail: null });
  });

  test("waits for timers before it reports done", () => {
    const { stdout, exit } = runInWorker(
      `setTimeout(() => console.log("later"), 20); console.log("now");`
    );
    expect(stdout).toBe("now\nlater\n");
    expect(exit?.exit).toBe("done");
  });

  test("sends each write before the program hangs", () => {
    const { stdout, exit } = runInWorker(
      `console.log("start"); while (true) {}`,
      { waitMs: 300 }
    );
    expect(stdout).toBe("start\n");
    expect(exit).toBeUndefined();
  });

  test("stops writing at the output budget", () => {
    const { stdout, exit } = runInWorker(
      `console.log("x".repeat(20000)); console.log("more");`
    );
    expect(stdout).toHaveLength(OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL);
    expect(exit?.exit).toBe("done");
  });

  test("reports an uncaught error as the exit reason", () => {
    const { exit } = runInWorker(`throw new Error("boom");`);
    expect(exit?.exit).toBe("error");
    expect(String(exit?.detail)).toStartWith("Uncaught Error: boom");
  });

  test("caps the exit reason", () => {
    const { exit } = runInWorker(`throw new Error("x".repeat(10000));`);
    expect(String(exit?.detail)).toHaveLength(DETAIL_LIMIT);
  });

  test("gives the program no way to message the frame or spawn workers", () => {
    const { stdout } = runInWorker(
      "console.log(typeof postMessage, typeof self.postMessage, typeof Worker);"
    );
    expect(stdout).toBe("undefined undefined undefined\n");
  });
});

describe.each(["timer first", "rejection first"] as const)(
  "sandbox worker with the %s",
  (order) => {
    test.each([
      [
        "an unawaited async function that throws",
        "async function main() {\n  console.log('starting');\n  throw new Error('boom');\n}\nmain();",
        "starting\n",
        "Uncaught (in promise) Error: boom",
      ],
      [
        "a bare rejection",
        "Promise.reject(new Error('nope'));",
        "",
        "Uncaught (in promise) Error: nope",
      ],
      [
        "a rejection inside a late timer",
        "setTimeout(() => { Promise.reject(new Error('late')); }, 30);",
        "",
        "Uncaught (in promise) Error: late",
      ],
      [
        "a rejection in nested promises",
        "Promise.resolve().then(() => Promise.resolve().then(() => { throw new Error('deep'); }));",
        "",
        "Uncaught (in promise) Error: deep",
      ],
    ])("reports %s as an error", (_, code, printed, reason) => {
      const { stdout, exit } = runInWorker(code, { order });
      expect(stdout).toBe(printed);
      expect(exit?.exit).toBe("error");
      expect(String(exit?.detail)).toStartWith(reason);
    });

    test.each([
      [
        "a handled rejection",
        "Promise.reject(new Error('x')).catch(() => console.log('caught'));",
        "caught\n",
      ],
      [
        "an awaited timer",
        "await new Promise((resolve) => setTimeout(resolve, 20));\nconsole.log('waited');",
        "waited\n",
      ],
    ])("reports %s as done", (_, code, printed) => {
      const { stdout, exit } = runInWorker(code, { order });
      expect(stdout).toBe(printed);
      expect(exit).toEqual({ type: "exit", exit: "done", detail: null });
    });
  }
);
