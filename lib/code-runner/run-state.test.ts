/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import {
  appendOutput,
  EMPTY_OUTPUT,
  INITIAL_RUN_STATE,
  OUTPUT_LIMIT,
  type OutputChunk,
  type RunAction,
  runReducer,
} from "./run-state";

const out = (text: string): OutputChunk => ({ stream: "stdout", text });
const err = (text: string): OutputChunk => ({ stream: "stderr", text });

describe("output buffer", () => {
  test("joins writes to the same stream and keeps stream order", () => {
    const buffer = appendOutput(
      appendOutput(EMPTY_OUTPUT, [out("a\n"), out("b\n")]),
      [err("boom\n"), out("c\n")]
    );
    expect(buffer.chunks).toEqual([out("a\nb\n"), err("boom\n"), out("c\n")]);
    expect(buffer.length).toBe(11);
    expect(buffer.truncated).toBe(false);
  });

  test("keeps output that exactly fills the limit", () => {
    const half = OUTPUT_LIMIT / 2;
    const buffer = appendOutput(EMPTY_OUTPUT, [
      out("x".repeat(half)),
      err("y".repeat(half)),
    ]);
    expect(buffer.length).toBe(OUTPUT_LIMIT);
    expect(buffer.truncated).toBe(false);
  });

  test("cuts output at the limit and marks it truncated", () => {
    const buffer = appendOutput(EMPTY_OUTPUT, [
      out("x".repeat(OUTPUT_LIMIT - 3)),
      err("12345"),
      out("never shown"),
    ]);
    expect(buffer.chunks).toEqual([
      out("x".repeat(OUTPUT_LIMIT - 3)),
      err("123"),
    ]);
    expect(buffer.length).toBe(OUTPUT_LIMIT);
    expect(buffer.truncated).toBe(true);
  });

  test("marks truncation when a full buffer receives more", () => {
    const full = appendOutput(EMPTY_OUTPUT, [out("x".repeat(OUTPUT_LIMIT))]);
    const over = appendOutput(full, [err("!")]);
    expect(over.truncated).toBe(true);
    expect(over.length).toBe(OUTPUT_LIMIT);
    expect(appendOutput(over, [out("late")])).toBe(over);
  });

  test("handles thousands of alternating chunks in one append", () => {
    const alternating = Array.from({ length: OUTPUT_LIMIT }, (_, index) =>
      index % 2 === 0 ? out("o") : err("e")
    );
    const started = performance.now();
    const buffer = appendOutput(EMPTY_OUTPUT, alternating);
    expect(buffer.chunks).toHaveLength(OUTPUT_LIMIT);
    expect(performance.now() - started).toBeLessThan(50);
  });
});

const reduce = (actions: RunAction[]) =>
  actions.reduce(runReducer, INITIAL_RUN_STATE);

describe("run state", () => {
  test("a run reports its output and its duration from the start", () => {
    const state = reduce([
      { type: "run", at: 100 },
      { type: "started", at: 110 },
      { type: "output", chunks: [out("1\n"), out("2\n")] },
      { type: "exit", exit: "done", at: 135, detail: null },
    ]);
    expect(state.status).toEqual({
      kind: "done",
      durationMs: 25,
      detail: null,
    });
    expect(state.output.chunks).toEqual([out("1\n2\n")]);
  });

  test("loading waits for the runtime and times only the run", () => {
    const loading = reduce([{ type: "run", at: 0 }, { type: "loading" }]);
    expect(loading.status).toEqual({ kind: "loading" });
    const timedOut = [
      { type: "started", at: 4000 },
      { type: "exit", exit: "timed-out", at: 9000, detail: null },
    ] satisfies RunAction[];
    expect(timedOut.reduce(runReducer, loading).status).toEqual({
      kind: "timed-out",
      durationMs: 5000,
      detail: null,
    });
  });

  test("a failure keeps its reason even when the output is full", () => {
    const state = reduce([
      { type: "run", at: 0 },
      { type: "output", chunks: [out("x".repeat(OUTPUT_LIMIT + 1))] },
      { type: "exit", exit: "error", at: 3, detail: "Uncaught Error: boom" },
    ]);
    expect(state.output.truncated).toBe(true);
    expect(state.status).toEqual({
      kind: "error",
      durationMs: 3,
      detail: "Uncaught Error: boom",
    });
  });

  test("stopping before the code starts has no duration", () => {
    const state = reduce([
      { type: "run", at: 0 },
      { type: "loading" },
      { type: "exit", exit: "stopped", at: 50, detail: null },
    ]);
    expect(state.status).toEqual({
      kind: "stopped",
      durationMs: null,
      detail: null,
    });
  });

  test("a new run and clear both drop the previous output", () => {
    const finished = reduce([
      { type: "run", at: 0 },
      { type: "output", chunks: [err("old\n")] },
      { type: "exit", exit: "error", at: 1, detail: null },
    ]);
    expect(runReducer(finished, { type: "run", at: 2 }).output).toEqual(
      EMPTY_OUTPUT
    );
    expect(runReducer(finished, { type: "clear" })).toEqual(INITIAL_RUN_STATE);
  });

  const late: RunAction[] = [
    { type: "loading" },
    { type: "started", at: 5 },
    { type: "output", chunks: [out("late\n")] },
    { type: "exit", exit: "done", at: 6, detail: null },
  ];

  test.each(["done", "error", "timed-out", "stopped"] as const)(
    "ignores events that arrive after the run ends as %s",
    (exit) => {
      const ended = reduce([
        { type: "run", at: 0 },
        { type: "exit", exit, at: 4, detail: null },
      ]);
      expect(late.reduce(runReducer, ended)).toBe(ended);
    }
  );

  test("ignores events that arrive after Clear", () => {
    expect(late.reduce(runReducer, INITIAL_RUN_STATE)).toBe(INITIAL_RUN_STATE);
  });
});
