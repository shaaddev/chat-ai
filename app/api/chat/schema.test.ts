/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { postRequestBodySchema, toUserTurn } from "./schema";

const CHAT_ID = "e027ffa1-67fd-4ff1-96fe-1c04b2e91864";
const CONVEX_MESSAGE_ID = "j97009qtqr7rwaaemyckqt53m9860aq7";
const message = {
  id: "0c1d1f0e-8d2a-4b8e-9a51-1f3b5b8f0b11",
  role: "user" as const,
  parts: [{ type: "text" as const, text: "Try again with fewer words." }],
};
const settings = { id: CHAT_ID, selectedChatModel: "chat-5-mini" };

const turnFor = (body: Record<string, unknown>) =>
  toUserTurn(postRequestBodySchema.parse({ ...settings, ...body }));

describe("POST /api/chat body", () => {
  test("a body without a trigger appends the message", () => {
    expect(turnFor({ message })).toEqual({
      type: "append",
      message,
    });
  });

  test("submit-message without a messageId appends the message", () => {
    expect(turnFor({ trigger: "submit-message", message }).type).toBe("append");
  });

  test("submit-message with a messageId edits that user message", () => {
    expect(
      turnFor({
        trigger: "submit-message",
        messageId: CONVEX_MESSAGE_ID,
        message: { ...message, id: CONVEX_MESSAGE_ID },
      })
    ).toEqual({
      type: "edit",
      userMessageId: CONVEX_MESSAGE_ID,
      message: { ...message, id: CONVEX_MESSAGE_ID },
    });
  });

  test("regenerate-message keeps the last user message and ignores its parts", () => {
    expect(
      turnFor({
        trigger: "regenerate-message",
        messageId: "an-assistant-message-id",
        message: { id: CONVEX_MESSAGE_ID, role: "user", parts: [] },
      })
    ).toEqual({ type: "regenerate", userMessageId: CONVEX_MESSAGE_ID });
  });

  test("rejects an unknown trigger", () => {
    const result = postRequestBodySchema.safeParse({
      ...settings,
      trigger: "resume-stream",
      message,
    });
    expect(result.success).toBe(false);
  });

  test("rejects a submit-message without message parts", () => {
    const result = postRequestBodySchema.safeParse({
      ...settings,
      message: { id: message.id, role: "user" },
    });
    expect(result.success).toBe(false);
  });
});
