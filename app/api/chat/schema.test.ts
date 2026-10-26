/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
} from "@/lib/uploadthing/attachments";
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

describe("POST /api/chat file parts", () => {
  const filePart = {
    type: "file" as const,
    mediaType: "image/webp",
    filename: "diagram.webp",
    size: 48_213,
    url: "https://abc123.ufs.sh/f/diagram-key",
  };
  const withParts = (parts: unknown[]) =>
    postRequestBodySchema.safeParse({
      ...settings,
      message: { ...message, parts },
    });

  test("accepts a message with attachments and no text", () => {
    const result = withParts([
      filePart,
      { ...filePart, mediaType: "application/pdf", filename: "spec.pdf" },
    ]);
    expect(result.success).toBe(true);
  });

  test("accepts PNG, JPEG, WebP, and GIF images and PDFs", () => {
    for (const mediaType of [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "application/pdf",
    ]) {
      expect(withParts([{ ...filePart, mediaType }]).success).toBe(true);
    }
  });

  test("rejects a type the uploader does not accept", () => {
    expect(withParts([{ ...filePart, mediaType: "image/heic" }]).success).toBe(
      false
    );
  });

  test("accepts a part saved before inline attachments, named by `name`", () => {
    const result = withParts([
      {
        type: "file",
        mediaType: "image/png",
        name: "old-upload.png",
        url: "https://abc123.ufs.sh/f/old-key",
      },
    ]);
    expect(result.success).toBe(true);
    const parsed = result.data?.message;
    expect(parsed && "parts" in parsed ? parsed.parts[0] : null).toMatchObject({
      filename: "old-upload.png",
    });
  });

  test("a part saved before inline attachments can be edited twice", () => {
    const legacyPart = {
      type: "file",
      mediaType: "image/png",
      name: "old-upload.png",
      url: "https://abc123.ufs.sh/f/old-key",
    };
    const firstEdit = withParts([legacyPart]);
    const savedParts =
      firstEdit.data && "parts" in firstEdit.data.message
        ? firstEdit.data.message.parts
        : [];

    expect(withParts(savedParts).success).toBe(true);
  });

  test("rejects more files than one message can carry", () => {
    const files = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...filePart,
        url: `https://abc123.ufs.sh/f/key-${index}`,
      }));

    expect(withParts(files(ATTACHMENT_MAX_COUNT)).success).toBe(true);
    expect(withParts(files(ATTACHMENT_MAX_COUNT + 1)).success).toBe(false);
  });

  test("rejects a file-only message to an image model", () => {
    const result = postRequestBodySchema.safeParse({
      ...settings,
      selectedChatModel: "chat-image-1-mini",
      message: { ...message, parts: [filePart] },
    });
    expect(result.success).toBe(false);
  });

  test("accepts an image model prompt that comes with a reference file", () => {
    const result = postRequestBodySchema.safeParse({
      ...settings,
      selectedChatModel: "chat-image-1-mini",
      message: {
        ...message,
        parts: [filePart, { type: "text", text: "A watercolor of this" }],
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects a file over the upload limit", () => {
    expect(
      withParts([{ ...filePart, size: ATTACHMENT_MAX_BYTES + 1 }]).success
    ).toBe(false);
  });
});
