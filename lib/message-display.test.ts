/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import {
  endsWithoutReply,
  getEmptyReplyReason,
  getReasoningText,
  isShownInThread,
} from "./message-display";
import type { ChatMessage } from "./types";

const reply = (
  parts: ChatMessage["parts"],
  metadata?: ChatMessage["metadata"]
): ChatMessage => ({ id: "reply", role: "assistant", parts, metadata });

const reasoning = (text: string) =>
  ({ type: "reasoning", text, state: "done" }) as const;

describe("getReasoningText", () => {
  test("skips the placeholder OpenRouter sends for encrypted reasoning", () => {
    const message = reply([
      reasoning("[REDACTED]"),
      reasoning("Compare the tenths digits."),
    ]);
    expect(getReasoningText(message)).toBe("Compare the tenths digits.");
  });
});

describe("getEmptyReplyReason", () => {
  test("names the length limit when a reply ends there with no text", () => {
    const message = reply([reasoning("Long thought")], {
      finishReason: "length",
    });
    expect(getEmptyReplyReason(message)).toBe("length");
  });

  test("covers other finishes that leave no text", () => {
    const message = reply([{ type: "text", text: "  " }], {
      finishReason: "stop",
    });
    expect(getEmptyReplyReason(message)).toBe("other");
  });

  test("ignores a reply that has text, even at the length limit", () => {
    const message = reply([{ type: "text", text: "Partial answer" }], {
      finishReason: "length",
    });
    expect(getEmptyReplyReason(message)).toBeNull();
  });

  test("ignores a reply that never finished, such as a stopped one", () => {
    expect(
      getEmptyReplyReason(reply([reasoning("Half a thought")]))
    ).toBeNull();
  });
});

describe("isShownInThread", () => {
  test("shows a reply that so far has only readable reasoning", () => {
    expect(isShownInThread(reply([reasoning("Thinking")]))).toBe(true);
  });

  test("hides a reply whose only reasoning is encrypted", () => {
    expect(isShownInThread(reply([reasoning("[REDACTED]")]))).toBe(false);
  });

  test("shows an empty reply once it has finished", () => {
    expect(isShownInThread(reply([], { finishReason: "length" }))).toBe(true);
  });
});

describe("endsWithoutReply", () => {
  const question: ChatMessage = {
    id: "question",
    role: "user",
    parts: [{ type: "text", text: "Reply with pong" }],
  };

  test("is true when the thread ends on a user message", () => {
    expect(endsWithoutReply([question])).toBe(true);
  });

  test("is true when the only reply after it shows nothing", () => {
    const failed = reply([{ type: "step-start" }], { model: "m" });
    expect(endsWithoutReply([question, failed])).toBe(true);
  });

  test("is false once a reply shows, even an empty-reply notice", () => {
    const answered = reply([{ type: "text", text: "pong" }]);
    const empty = reply([], { finishReason: "stop" });
    expect(endsWithoutReply([question, answered])).toBe(false);
    expect(endsWithoutReply([question, empty])).toBe(false);
  });

  test("is false for an empty thread", () => {
    expect(endsWithoutReply([])).toBe(false);
  });
});
