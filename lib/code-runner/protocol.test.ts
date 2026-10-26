/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import {
  type FrameContext,
  OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL,
  randomId,
  readFrameMessage,
} from "./protocol";
import { DETAIL_LIMIT } from "./run-state";

const frame = { name: "sandbox" } as unknown as MessageEventSource;
const other = { name: "other" } as unknown as MessageEventSource;
const RUN = "run-1";
const HEX_ID = /^[0-9a-f]{32}$/;

const context: FrameContext = {
  frame,
  isActiveRun: (runId) => runId === RUN,
};

const read = (
  data: unknown,
  overrides: { source?: MessageEventSource | null; origin?: string } = {}
) =>
  readFrameMessage(
    {
      data,
      origin: overrides.origin ?? "null",
      source: overrides.source === undefined ? frame : overrides.source,
    },
    context
  );

const output = (chunks: unknown) => ({ type: "output", runId: RUN, chunks });

describe("readFrameMessage", () => {
  test.each([
    [{ type: "ready" }],
    [{ type: "loading", runId: RUN }],
    [{ type: "started", runId: RUN }],
    [
      output([
        { stream: "stdout", text: "1\n" },
        { stream: "stderr", text: "boom\n" },
      ]),
    ],
    [{ type: "exit", runId: RUN, exit: "done", detail: null }],
    [{ type: "exit", runId: RUN, exit: "error", detail: "Uncaught Error: x" }],
    [{ type: "exit", runId: RUN, exit: "timed-out", detail: null }],
  ])("accepts %j from the sandbox frame", (data) => {
    expect(read(data)).toEqual(data as never);
  });

  test("drops fields the protocol does not define", () => {
    expect(read({ type: "started", runId: RUN, html: "<img>" })).toEqual({
      type: "started",
      runId: RUN,
    });
  });

  test("rejects messages from any other window", () => {
    expect(read({ type: "ready" }, { source: other })).toBeNull();
    expect(read({ type: "ready" }, { source: null })).toBeNull();
    expect(
      readFrameMessage(
        { data: { type: "ready" }, origin: "null", source: frame },
        { ...context, frame: null }
      )
    ).toBeNull();
  });

  test("rejects messages that do not come from an opaque origin", () => {
    expect(
      read({ type: "ready" }, { origin: "https://chat.example" })
    ).toBeNull();
  });

  test("rejects messages for a run that is not active", () => {
    expect(
      read({ type: "exit", runId: "run-2", exit: "done", detail: null })
    ).toBeNull();
    expect(read({ type: "started" })).toBeNull();
    expect(read({ type: "started", runId: 1 })).toBeNull();
  });

  test.each([
    ["a string", "ready"],
    ["null", null],
    ["an unknown type", { type: "eval", runId: RUN }],
    [
      "a stop the frame cannot claim",
      { type: "exit", runId: RUN, exit: "stopped", detail: null },
    ],
    ["an unknown exit", { type: "exit", runId: RUN, exit: "ok", detail: null }],
    ["an exit without a detail", { type: "exit", runId: RUN, exit: "done" }],
    [
      "an oversized detail",
      {
        type: "exit",
        runId: RUN,
        exit: "error",
        detail: "x".repeat(DETAIL_LIMIT + 1),
      },
    ],
    ["chunks that are not a list", output("hi")],
    ["an unknown stream", output([{ stream: "stdin", text: "x" }])],
    ["text that is not a string", output([{ stream: "stdout", text: 1 }])],
    ["empty text", output([{ stream: "stdout", text: "" }])],
    [
      "more text than the output budget",
      output([
        {
          stream: "stdout",
          text: "x".repeat(OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL),
        },
        { stream: "stderr", text: "y" },
      ]),
    ],
  ])("rejects %s", (_, data) => {
    expect(read(data)).toBeNull();
  });
});

describe("randomId", () => {
  test("returns 128 random bits as hex", () => {
    const ids = new Set(Array.from({ length: 100 }, randomId));
    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(HEX_ID);
    }
  });
});
