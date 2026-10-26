/// <reference types="bun-types/test" />
import { afterEach, describe, expect, test } from "bun:test";
import {
  adoptThread,
  joinDraftText,
  requestSettle,
  turnFailure,
  turnOutcome,
} from "./chat-turn";
import { ChatSDKError } from "./errors";
import type { ChatMessage } from "./types";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const respondWith = (response: Response) => {
  globalThis.fetch = (() => Promise.resolve(response)) as typeof fetch;
};

const message = (
  id: string,
  role: ChatMessage["role"],
  text: string,
  metadata?: ChatMessage["metadata"]
): ChatMessage => ({ id, role, parts: [{ type: "text", text }], metadata });

const ended = (error?: unknown) => ({
  isAbort: false,
  isError: error !== undefined,
  error,
});

describe("turnOutcome", () => {
  test("a stream that ran to its end is finished", () => {
    expect(turnOutcome(ended())).toBe("finished");
  });

  test("an error response from the chat route is a refusal", () => {
    for (const code of [
      "bad_request:api",
      "unauthorized:chat",
      "forbidden:upload",
      "not_found:chat",
    ] as const) {
      expect(turnOutcome(ended(new ChatSDKError(code)))).toBe("refused");
    }
  });

  test("a stop, a dropped connection, a server failure, or an error inside the stream leaves the turn unknown", () => {
    expect(
      turnOutcome({
        isAbort: true,
        isError: false,
        error: new ChatSDKError("bad_request:api"),
      })
    ).toBe("unknown");
    for (const error of [
      new TypeError("Failed to fetch"),
      new ChatSDKError("offline:chat"),
      new ChatSDKError("server:api"),
      new Error("An error occurred while generating the response."),
    ]) {
      expect(turnOutcome(ended(error))).toBe("unknown");
    }
  });
});

test("a failure is a refusal, a lost request, or an error inside the stream", () => {
  expect(turnFailure(new ChatSDKError("bad_request:api"))).toBe("refused");
  expect(turnFailure(new TypeError("Failed to fetch"))).toBe("lost");
  expect(turnFailure(new ChatSDKError("offline:chat"))).toBe("lost");
  expect(turnFailure(new ChatSDKError("server:api"))).toBe("lost");
  expect(turnFailure(new Error("The model failed."))).toBe("stream");
});

describe("requestSettle", () => {
  test("names the turn and whether a reply showed, and answers with the saved thread", async () => {
    const saved = [message("u1", "user", "Hello")];
    let sent: { url: string; body: unknown } | undefined;
    globalThis.fetch = ((url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return Promise.resolve(
        Response.json({ messages: saved, turnSaved: true })
      );
    }) as typeof fetch;

    expect(await requestSettle("chat", "turn", true)).toEqual({
      messages: saved,
      turnSaved: true,
    });
    expect(sent).toEqual({
      url: "/api/chat/chat/settle",
      body: { turnId: "turn", expectReply: true },
    });
  });

  test("reads a chat the server doesn't have as an empty thread", async () => {
    respondWith(Response.json({ code: "not_found:chat" }, { status: 404 }));

    expect(await requestSettle("chat", "turn", false)).toEqual({
      messages: [],
      turnSaved: false,
    });
  });

  test("fails when the server can't answer or answers without a thread", async () => {
    respondWith(Response.json({ code: "unauthorized:chat" }, { status: 401 }));
    await expect(requestSettle("chat", "turn", false)).rejects.toBeInstanceOf(
      ChatSDKError
    );

    respondWith(new Response("Internal server error", { status: 500 }));
    await expect(requestSettle("chat", "turn", false)).rejects.toBeInstanceOf(
      ChatSDKError
    );

    respondWith(Response.json({ messages: "none" }));
    await expect(requestSettle("chat", "turn", false)).rejects.toThrow();
  });
});

describe("adoptThread", () => {
  test("keeps the object of a message whose saved parts match the screen", () => {
    const question = message("u1", "user", "Write a story");
    const reply = message("a1", "assistant", "Once upon a time");

    const adopted = adoptThread(
      [question, reply],
      [message("u1", "user", "Write a story"), reply]
    );

    expect(adopted[0]).toBe(question);
    expect(adopted[1]).toBe(reply);
  });

  test("shows the saved reply in place of the one the screen kept", () => {
    const question = message("u1", "user", "Write a story");
    const kept = message("a1", "assistant", "The old reply");
    const saved = message("a2", "assistant", "The salt spray");

    expect(adoptThread([question, kept], [question, saved])).toEqual([
      question,
      saved,
    ]);
  });

  test("shows the saved text of a stopped reply and keeps its display metadata", () => {
    const shown = message("a1", "assistant", "The rhythmic sweep", {
      model: "chat-5-mini",
      useSearch: true,
    });

    expect(
      adoptThread(
        [shown],
        [
          message("a1", "assistant", "The rhythmic sweep of the beam", {
            createdAt: "2026-10-26T12:00:00Z",
            model: "chat-5-mini",
          }),
        ]
      )
    ).toEqual([
      message("a1", "assistant", "The rhythmic sweep of the beam", {
        createdAt: "2026-10-26T12:00:00Z",
        model: "chat-5-mini",
        useSearch: true,
      }),
    ]);
  });
});

test("restored text goes in front of anything typed since", () => {
  expect(joinDraftText("Unsent question", "")).toBe("Unsent question");
  expect(joinDraftText("Unsent question", "Follow-up")).toBe(
    "Unsent question\n\nFollow-up"
  );
  expect(joinDraftText("", "Follow-up")).toBe("Follow-up");
});
