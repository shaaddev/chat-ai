/// <reference types="bun-types/test" />
import { afterEach, describe, expect, test } from "bun:test";
import "sucrase";
import "./sandbox-document";
import type { Runner } from "./languages";
import {
  HOST_BACKSTOP_MARGIN_MS,
  type HostMessage,
  LOAD_TIMEOUT_MS,
  READY_TIMEOUT_MS,
  RUN_TIMEOUT_MS,
} from "./protocol";
import type { RunEvent } from "./run-state";

const JAVASCRIPT: Runner = {
  label: "JavaScript",
  runtime: "javascript",
  transpile: null,
};
const TYPESCRIPT: Runner = {
  label: "TypeScript",
  runtime: "javascript",
  transpile: "typescript",
};

const COMPILER_ERROR = /^SyntaxError: /;
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

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

interface FakeFrame {
  readonly received: HostMessage[];
  removed: boolean;
  readonly window: { postMessage: (message: HostMessage, to: string) => void };
}

let instances = 0;

async function openPage() {
  const clock = new Clock();
  const frames: FakeFrame[] = [];
  let listener: ((event: unknown) => void) | null = null;
  Object.assign(globalThis, {
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    window: {
      location: { origin: "https://chat.example" },
      addEventListener: (_: string, handler: (event: unknown) => void) => {
        listener = handler;
      },
      removeEventListener: () => {
        listener = null;
      },
    },
    document: {
      body: { append: () => undefined },
      createElement: () => {
        const frame: FakeFrame = {
          received: [],
          removed: false,
          window: {
            postMessage: (message, to) => {
              expect(to).toBe("*");
              frame.received.push(message);
            },
          },
        };
        frames.push(frame);
        return {
          setAttribute: () => undefined,
          remove: () => {
            frame.removed = true;
          },
          contentWindow: frame.window,
        };
      },
    },
  });
  instances += 1;
  const host = (await import(
    `./host?instance=${instances}`
  )) as typeof import("./host");
  const events: RunEvent[] = [];
  const start = (runner: Runner, source: string) =>
    host.startRun(runner, source, (event) => events.push(event));
  const fromFrame = (data: Record<string, unknown>) =>
    listener?.({ source: frames.at(-1)?.window, origin: "null", data });
  const runIdOf = (frame: FakeFrame | undefined) => {
    const run = frame?.received.find((message) => message.type === "run");
    if (!run) {
      throw new Error("the frame never received a run");
    }
    return run.runId;
  };
  return { clock, events, frames, fromFrame, runIdOf, start };
}

const launched = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  Object.assign(globalThis, {
    setTimeout: realSetTimeout,
    clearTimeout: realClearTimeout,
  });
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
});

describe("run host", () => {
  test("holds a run until the frame is ready, then reports what the frame sends", async () => {
    const page = await openPage();
    page.start(JAVASCRIPT, "console.log(1)");
    await launched();
    const [frame] = page.frames;
    expect(frame.received).toEqual([]);

    page.fromFrame({ type: "ready" });
    expect(frame.received).toEqual([
      {
        type: "run",
        runId: expect.any(String),
        runtime: "javascript",
        code: "console.log(1)",
      },
    ]);
    const runId = page.runIdOf(frame);
    page.fromFrame({ type: "started", runId });
    page.fromFrame({
      type: "output",
      runId,
      chunks: [{ stream: "stdout", text: "1\n" }],
    });
    page.fromFrame({ type: "exit", runId, exit: "done", detail: null });
    expect(page.events.map((event) => event.type)).toEqual([
      "started",
      "output",
      "exit",
    ]);
    expect(page.events.at(-1)).toMatchObject({ exit: "done", detail: null });
  });

  test("ignores Stop and frame messages once a run has finished", async () => {
    const page = await openPage();
    const stop = page.start(JAVASCRIPT, "1");
    await launched();
    page.fromFrame({ type: "ready" });
    const runId = page.runIdOf(page.frames[0]);
    page.fromFrame({ type: "exit", runId, exit: "error", detail: "boom" });
    stop();
    page.fromFrame({ type: "exit", runId, exit: "done", detail: null });
    expect(page.events).toEqual([
      { type: "exit", exit: "error", at: expect.any(Number), detail: "boom" },
    ]);
    expect(page.frames[0].received.map((message) => message.type)).toEqual([
      "run",
    ]);
  });

  test("Stop before the frame is ready drops the run the frame has not seen", async () => {
    const page = await openPage();
    const stop = page.start(JAVASCRIPT, "1");
    await launched();
    stop();
    page.fromFrame({ type: "ready" });
    expect(page.frames[0].received).toEqual([]);
    expect(page.events).toEqual([
      { type: "exit", exit: "stopped", at: expect.any(Number), detail: null },
    ]);
  });

  test("Stop after the frame has the run asks the frame to stop it", async () => {
    const page = await openPage();
    const stop = page.start(JAVASCRIPT, "1");
    await launched();
    page.fromFrame({ type: "ready" });
    const runId = page.runIdOf(page.frames[0]);
    stop();
    page.fromFrame({ type: "exit", runId, exit: "done", detail: null });
    expect(page.frames[0].received.at(-1)).toEqual({ type: "stop", runId });
    expect(page.events).toEqual([
      { type: "exit", exit: "stopped", at: expect.any(Number), detail: null },
    ]);
  });

  test("Stop while TypeScript compiles never sends the run", async () => {
    const page = await openPage();
    const stop = page.start(TYPESCRIPT, "const n: number = 1;");
    stop();
    await launched();
    expect(page.frames).toEqual([]);
    expect(page.events.map((event) => event.type)).toEqual(["exit"]);
  });

  test("a TypeScript error ends the run with the compiler's reason", async () => {
    const page = await openPage();
    page.start(TYPESCRIPT, "const n: = 1;");
    await launched();
    expect(page.events).toEqual([
      {
        type: "exit",
        exit: "error",
        at: expect.any(Number),
        detail: expect.stringMatching(COMPILER_ERROR),
      },
    ]);
  });

  test("ends a started run when the frame goes silent past its own timeout", async () => {
    const page = await openPage();
    page.start(JAVASCRIPT, "1");
    await launched();
    page.fromFrame({ type: "ready" });
    page.fromFrame({ type: "started", runId: page.runIdOf(page.frames[0]) });
    page.clock.advance(RUN_TIMEOUT_MS + HOST_BACKSTOP_MARGIN_MS - 1);
    expect(page.events.map((event) => event.type)).toEqual(["started"]);

    page.clock.advance(1);
    expect(page.events.at(-1)).toMatchObject({
      type: "exit",
      exit: "timed-out",
      detail: "The sandbox stopped responding.",
    });
    expect(page.frames[0].removed).toBe(true);
  });

  test("ends a run the frame never starts and opens a new frame next time", async () => {
    const page = await openPage();
    page.start(JAVASCRIPT, "1");
    await launched();
    page.fromFrame({ type: "ready" });
    page.clock.advance(LOAD_TIMEOUT_MS + HOST_BACKSTOP_MARGIN_MS);
    expect(page.events).toEqual([
      {
        type: "exit",
        exit: "timed-out",
        at: expect.any(Number),
        detail: "The sandbox stopped responding.",
      },
    ]);

    page.start(JAVASCRIPT, "2");
    await launched();
    expect(page.frames).toHaveLength(2);
  });

  test("ends a waiting run when the frame never loads", async () => {
    const page = await openPage();
    page.start(JAVASCRIPT, "1");
    await launched();
    page.clock.advance(READY_TIMEOUT_MS);
    expect(page.events.at(-1)).toMatchObject({
      type: "exit",
      exit: "timed-out",
    });
    expect(page.frames[0].removed).toBe(true);
  });
});
