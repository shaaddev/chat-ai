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

const NO_NETWORK = /^Uncaught TypeError: This sandbox has no network access\./;
const SCRIPT_TAG = /<script\b[^>]*>/g;
const SCRIPT_END = /<\/script>/g;
const PARENT_ORIGIN = "https://chat.example";
const HTML = sandboxDocument({ nonce: "abc123", parentOrigin: PARENT_ORIGIN });
const FRAME_SCRIPT = HTML.slice(
  HTML.indexOf(">", HTML.indexOf("<script")) + 1,
  HTML.indexOf("</script>")
);

describe("sandbox policy", () => {
  test("allows only the nonced bootstrap, blob workers, and the pinned Pyodide release", () => {
    expect(sandboxPolicy("abc123")).toBe(
      "default-src 'none'; script-src 'nonce-abc123' 'unsafe-eval' 'wasm-unsafe-eval' blob:; worker-src blob:; connect-src https://cdn.jsdelivr.net/pyodide/v314.0.7/full/; base-uri 'none'; form-action 'none'"
    );
  });

  test("sets the policy and drops the referrer before its only script runs", () => {
    expect(HTML.slice(0, HTML.indexOf("<script"))).toBe(
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${sandboxPolicy("abc123")}"><meta name="referrer" content="no-referrer"></head><body>`
    );
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

  test("sends what a program printed before it exits within one batch", () => {
    const frame = loadFrame();
    frame.run("a", "javascript");
    frame.workers[0].emit({ type: "output", stream: "stdout", text: "fast\n" });
    frame.workers[0].emit({ type: "exit", exit: "done", detail: null });
    expect(frame.of("a").slice(1)).toEqual([
      {
        type: "output",
        runId: "a",
        chunks: [{ stream: "stdout", text: "fast\n" }],
      },
      { type: "exit", runId: "a", exit: "done", detail: null },
    ]);
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
// child process whose timers and rejection reports are explicit queues. Like
// a browser, it drops the report for a rejection handled before the report
// runs. Host work, such as a WebAssembly compile, a Blob read, or a port
// message, resolves from a third queue that always runs last. An uncaught
// throw reaches the error listener the way WebKit reports one from compiled
// code: as "Script error." with no error object.
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
let workerClosed = false;
globalThis.postMessage = (message) => {
  writeSync(1, JSON.stringify(message) + "\\n");
  if (message.type === "exit") process.exit(0);
};
globalThis.addEventListener = (type, handler) => listeners.set(type, handler);
globalThis.close = () => {
  workerClosed = true;
};
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
process.on("unhandledRejection", (reason, promise) => {
  reports.push({ promise, run: () => listeners.get("unhandledrejection")({ reason, preventDefault() {}, stopImmediatePropagation() {} }) });
  schedule();
});
process.on("rejectionHandled", (promise) => {
  const at = reports.findIndex((report) => report.promise === promise);
  if (at !== -1) reports.splice(at, 1);
});
const host = [];
const fromHost = (work) => (...args) => new Promise((resolve, reject) => {
  work(...args).then(
    (value) => { host.push(() => resolve(value)); schedule(); },
    (error) => { host.push(() => reject(error)); schedule(); }
  );
});
WebAssembly.instantiate = fromHost(WebAssembly.instantiate.bind(WebAssembly));
const blobText = Blob.prototype.text;
Blob.prototype.text = function () { return fromHost(() => blobText.call(this))(); };
class Port {
  listeners = [];
  handler = null;
  started = false;
  closed = false;
  entangled = true;
  queue = [];
  get onmessage() { return this.handler; }
  set onmessage(handler) { this.handler = handler; this.enable(); }
  start() { this.enable(); }
  enable() {
    if (this.started) return;
    this.started = true;
    for (const data of this.queue.splice(0)) this.deliver(data);
  }
  deliver(data) {
    host.push(() => {
      if (this.closed) return;
      for (const listener of [...this.listeners, this.handler]) if (listener) listener({ data });
    });
    schedule();
  }
  postMessage(data) {
    if (typeof data === "function") throw new DOMException("could not be cloned", "DataCloneError");
    if (!this.entangled) return;
    if (this.other.started) this.other.deliver(data);
    else this.other.queue.push(data);
  }
  addEventListener(type, listener) { if (type === "message") this.listeners.push(listener); }
  close() {
    this.closed = true;
    this.entangled = false;
    this.other.entangled = false;
  }
}
globalThis.MessagePort = Port;
globalThis.MessageChannel = class {
  constructor() {
    this.port1 = new Port();
    this.port2 = new Port();
    this.port1.other = this.port2;
    this.port2.other = this.port1;
  }
};
function nextTimer() {
  let next = null;
  for (const entry of timers) if (!next || entry[1].at < next[1].at) next = entry;
  if (!next) return null;
  timers.delete(next[0]);
  now = Math.max(now, next[1].at);
  return next[1].run;
}
function nextReport() {
  return reports.shift()?.run ?? null;
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  realSetTimeout(step, 1);
}
function step() {
  scheduled = false;
  if (workerClosed) return;
  const task = (TIMER_FIRST ? nextTimer() ?? nextReport() : nextReport() ?? nextTimer()) ?? host.shift();
  if (!task) return;
  try {
    task();
  } catch {
    listeners.get("error")({ error: null, message: "Script error.", preventDefault() {} });
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

  test.each([
    ["fetch", "await fetch('https://example.com');"],
    ["XMLHttpRequest", "new XMLHttpRequest();"],
    ["WebSocket", "new WebSocket('wss://example.com');"],
    ["importScripts", "importScripts('https://example.com/a.js');"],
  ])(
    "says the sandbox has no network access when the program calls %s",
    (_, code) => {
      const { exit } = runInWorker(code);
      expect(exit).toEqual({
        type: "exit",
        exit: "error",
        detail: expect.stringMatching(NO_NETWORK),
      });
    }
  );

  test("gives the program no way to message the frame or spawn workers", () => {
    const { stdout } = runInWorker(
      "console.log(typeof postMessage, typeof self.postMessage, typeof Worker);"
    );
    expect(stdout).toBe("undefined undefined undefined\n");
  });
});

const HANDLED_BY_A_TIMER_BEFORE_THE_REPORT: Record<
  TaskOrder,
  { stdout: string; exit: string }
> = {
  "timer first": { stdout: "caught\n", exit: "done" },
  "rejection first": { stdout: "", exit: "error" },
};

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
      [
        "a throw inside a timer",
        "setTimeout(() => {\n  console.log('tick');\n  throw new Error('in timer');\n}, 10);",
        "tick\n",
        "Uncaught Error: in timer",
      ],
      [
        "a throw the browser reports without its error",
        "const { port1, port2 } = new MessageChannel();\nport1.onmessage = () => { throw new Error('in handler'); };\nport2.postMessage(1);\nawait new Blob(['x']).text();",
        "",
        "Script error.",
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
      [
        "an unawaited WebAssembly compile",
        "WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])).then(() => console.log('instantiated'));",
        "instantiated\n",
      ],
      [
        "an unawaited Blob read",
        "new Blob(['from a blob']).text().then(console.log);",
        "from a blob\n",
      ],
      [
        "a handled rejection from host work",
        "WebAssembly.instantiate(new Uint8Array([1, 2, 3])).catch(() => console.log('caught'));",
        "caught\n",
      ],
      [
        "an awaited MessageChannel round trip",
        "const { port1, port2 } = new MessageChannel();\nconst got = new Promise((resolve) => { port1.onmessage = (event) => resolve(event.data); });\nport2.postMessage('ping');\nconsole.log('got', await got);",
        "got ping\n",
      ],
      [
        "a message posted after the receiving port closed",
        "const { port1, port2 } = new MessageChannel();\nport2.onmessage = () => {};\nport2.close();\nport1.postMessage(1);\nconsole.log('posted');",
        "posted\n",
      ],
      [
        "a message posted on a closed port",
        "const { port1, port2 } = new MessageChannel();\nport2.onmessage = () => {};\nport1.close();\nport1.postMessage(1);\nconsole.log('posted');",
        "posted\n",
      ],
      [
        "a program that closes its worker",
        "console.log('closing');\nclose();\nconsole.log('after close');",
        "closing\n",
      ],
      [
        "a message to a port that never starts",
        "const { port1 } = new MessageChannel();\nport1.postMessage(1);\nconsole.log('hi');",
        "hi\n",
      ],
      [
        "a message that cannot be cloned",
        "try { new MessageChannel().port1.postMessage(() => {}); } catch { console.log('caught'); }",
        "caught\n",
      ],
      [
        "a message to a port closed before delivery",
        "const { port1, port2 } = new MessageChannel();\nport2.onmessage = (event) => console.log(event.data);\nport1.postMessage('x');\nport2.close();\nconsole.log('closed');",
        "closed\n",
      ],
    ])("reports %s as done", (_, code, printed) => {
      const { stdout, exit } = runInWorker(code, { order });
      expect(stdout).toBe(printed);
      expect(exit).toEqual({ type: "exit", exit: "done", detail: null });
    });

    test("reports a rejection from unawaited host work as an error", () => {
      const { exit } = runInWorker(
        "WebAssembly.instantiate(new Uint8Array([1, 2, 3]));",
        { order }
      );
      expect(exit?.exit).toBe("error");
      expect(String(exit?.detail)).toStartWith(
        "Uncaught (in promise) CompileError"
      );
    });

    test("reports a rejection only if no timer handles it before the report", () => {
      const { stdout, exit } = runInWorker(
        "const p = Promise.reject(new Error('x'));\nsetTimeout(() => p.catch(() => console.log('caught')), 0);",
        { order }
      );
      expect({ stdout, exit: exit?.exit }).toEqual(
        HANDLED_BY_A_TIMER_BEFORE_THE_REPORT[order]
      );
    });
  }
);
