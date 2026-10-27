/// <reference types="bun-types/test" />
import { afterEach, describe, expect, jest, test } from "bun:test";
import {
  adoptThread,
  createTurnGate,
  requestSettle,
  type TurnEffects,
  type TurnGate,
  turnFailure,
} from "./chat-turn";
import { ChatSDKError } from "./errors";
import { createSavedThreads, type SavedThreads } from "./saved-threads";
import type { ChatMessage } from "./types";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  jest.useRealTimers();
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

interface HeldRequest {
  body: Record<string, unknown>;
  fail: (error: unknown) => void;
  respond: (response: Response) => void;
  signal: AbortSignal | undefined;
}

function fakeServer() {
  const chat: HeldRequest[] = [];
  const settle: HeldRequest[] = [];
  const threads: HeldRequest[] = [];
  const queueFor = (url: string) => {
    if (url.endsWith("/settle")) {
      return settle;
    }
    return url.startsWith("/api/chats/") ? threads : chat;
  };
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? undefined;
      signal?.addEventListener("abort", () => reject(signal.reason));
      queueFor(String(input)).push({
        body: JSON.parse(String(init?.body ?? "{}")),
        fail: reject,
        respond: resolve,
        signal,
      });
    })) as typeof fetch;
  return { chat, settle, threads };
}

const UUID = /^[0-9a-f-]{36}$/;
const encoder = new TextEncoder();

function streamReply(
  request: HeldRequest,
  { text, finish }: { text?: string; finish: boolean }
) {
  let body: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start: (controller) => {
      body = controller;
    },
  });
  request.signal?.addEventListener("abort", () =>
    body?.error(request.signal?.reason)
  );
  const send = (chunk: Record<string, unknown>) =>
    body?.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
  send({ type: "start" });
  if (text) {
    send({ type: "text-start", id: "t" });
    send({ type: "text-delta", id: "t", delta: text });
  }
  if (finish) {
    if (text) {
      send({ type: "text-end", id: "t" });
    }
    send({ type: "finish" });
    body?.close();
  }
  request.respond(new Response(stream));
}

const errorResponse = (status: number, code: string) =>
  Response.json({ code, message: "Refused", cause: "Refused" }, { status });

const settled = (messages: ChatMessage[], turnSaved: boolean) =>
  Response.json({ messages, turnSaved });

async function until(check: () => boolean, attempts = 500): Promise<void> {
  if (check() || attempts === 0) {
    expect(check()).toBe(true);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 1));
  await until(check, attempts - 1);
}

function recordingEffects(overrides: Partial<TurnEffects> = {}) {
  const calls: string[] = [];
  const effects: TurnEffects = {
    chatSaved: () => calls.push("chat saved"),
    isMounted: () => true,
    newChatSend: (send) => calls.push(`new chat ${send}`),
    refreshChats: () => undefined,
    sendBlocked: () => calls.push("send blocked"),
    showError: () => calls.push("error shown"),
    turnFinished: (_, keptPrevious) =>
      calls.push(keptPrevious ? "finished, kept the old reply" : "finished"),
    turnNotSaved: (request, { maybeSaved, notify }) => {
      calls.push(
        `handed back ${request.kind}${notify ? ", told" : ""}${maybeSaved ? ", maybe saved" : ""}`
      );
    },
    ...overrides,
  };
  return { calls, effects };
}

const QUESTION = message("u0", "user", "Earlier question");
const ANSWER = message("a0", "assistant", "Earlier answer");

function openChat(
  initialMessages: ChatMessage[] = [QUESTION, ANSWER],
  overrides: Partial<TurnEffects> = {},
  savedThreads: SavedThreads = createSavedThreads()
) {
  const server = fakeServer();
  const { calls, effects } = recordingEffects(overrides);
  const gate = createTurnGate({
    chatId: "chat",
    initialMessages,
    savedThreads,
    requestSettings: () => ({ selectedChatModel: "chat-5-mini" }),
    effects,
  });
  gate.onScreen();
  return { calls, gate, server };
}

const shown = (gate: TurnGate) =>
  gate.chat.messages.map(
    ({ role, parts }) =>
      `${role}: ${parts.map((part) => (part.type === "text" ? part.text : "")).join("")}`
  );

const ask = (gate: TurnGate, text: string) =>
  gate.start(() => ({ kind: "append", files: [], text }));

describe("a turn", () => {
  test("sends its id with the message and shows the finished reply", async () => {
    const { calls, gate, server } = openChat([]);

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    const [request] = server.chat;
    streamReply(request, { text: "Hi there", finish: true });
    await until(() => gate.getStatus().phase === "idle");

    expect(request.body).toMatchObject({
      id: "chat",
      trigger: "submit-message",
      selectedChatModel: "chat-5-mini",
      message: { role: "user", parts: [{ type: "text", text: "Hello" }] },
    });
    expect(request.body.turnId).toMatch(UUID);
    expect(shown(gate)).toEqual(["user: Hello", "assistant: Hi there"]);
    expect(calls).toEqual(["new chat sent", "chat saved", "finished"]);
    expect(server.settle).toHaveLength(0);
  });

  test("that the server refuses restores the saved thread and hands the text back without a settle", async () => {
    const { calls, gate, server } = openChat();

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].respond(errorResponse(400, "bad_request:api"));
    await until(() => gate.getStatus().phase === "idle");

    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
    ]);
    expect(calls).toEqual(["error shown", "handed back append"]);
    expect(server.settle).toHaveLength(0);
  });

  test("whose connection drops is settled, and the screen shows what the server saved", async () => {
    const { calls, gate, server } = openChat();

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    const [request] = server.chat;
    request.fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    expect(gate.getStatus().phase).toBe("settling");
    server.settle[0].respond(
      settled([QUESTION, ANSWER, message("u1", "user", "Hello")], true)
    );
    await until(() => gate.getStatus().phase === "idle");

    expect(server.settle[0].body).toEqual({
      turnId: request.body.turnId,
      expectReply: false,
    });
    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
      "user: Hello",
    ]);
    expect(calls).toEqual([]);
  });

  test("stopped after reply text asks the server to wait for that reply, then shows the saved text", async () => {
    const { gate, server } = openChat();

    await ask(gate, "Tell me a story");
    await until(() => server.chat.length === 1);
    streamReply(server.chat[0], { text: "Once upon", finish: false });
    await until(() => shown(gate).at(-1) === "assistant: Once upon");
    gate.chat.stop();
    await until(() => server.settle.length === 1);
    const [userTurn, reply] = gate.chat.messages.slice(-2);
    server.settle[0].respond(
      settled(
        [
          QUESTION,
          ANSWER,
          userTurn,
          { ...reply, parts: [{ type: "text", text: "Once upon a time" }] },
        ],
        true
      )
    );
    await until(() => gate.getStatus().phase === "idle");

    expect(server.settle[0].body.expectReply).toBe(true);
    expect(shown(gate).at(-1)).toBe("assistant: Once upon a time");
  });

  test("that the server answers with a 5xx is settled, because the server may have saved it", async () => {
    const { calls, gate, server } = openChat();

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    const [request] = server.chat;
    request.respond(errorResponse(500, "server:api"));
    await until(() => server.settle.length === 1);
    const [userTurn] = gate.chat.messages.slice(-1);
    server.settle[0].respond(settled([QUESTION, ANSWER, userTurn], true));
    await until(() => gate.getStatus().phase === "idle");

    expect(server.settle[0].body).toEqual({
      turnId: request.body.turnId,
      expectReply: false,
    });
    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
      "user: Hello",
    ]);
    expect(calls).toEqual([]);
  });

  test("the server never saved goes back to the user, who is told", async () => {
    const { calls, gate, server } = openChat();

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].respond(settled([QUESTION, ANSWER], false));
    await until(() => gate.getStatus().phase === "idle");

    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
    ]);
    expect(calls).toEqual(["handed back append, told"]);
  });

  test("lost in a new chat the server can't find goes back as possibly saved", async () => {
    const { calls, gate, server } = openChat([]);

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].respond(errorResponse(404, "not_found:chat"));
    await until(() => gate.getStatus().phase === "idle");

    expect(shown(gate)).toEqual([]);
    expect(calls).toEqual([
      "new chat sent",
      "new chat lost",
      "handed back append, told, maybe saved",
    ]);
  });

  test("that regenerates into an empty reply keeps the reply it would replace", async () => {
    const { calls, gate, server } = openChat();

    await gate.start(() => ({ kind: "regenerate" }));
    await until(() => server.chat.length === 1);
    const [request] = server.chat;
    streamReply(request, { finish: true });
    await until(() => gate.getStatus().phase === "idle");

    expect(request.body).toMatchObject({
      trigger: "regenerate-message",
      message: { id: "u0" },
    });
    expect(request.body.turnId).toMatch(UUID);
    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
    ]);
    expect(calls).toEqual(["finished, kept the old reply"]);
  });

  test("that edits a message sends its id with the edited text and shows the new reply", async () => {
    const { gate, server } = openChat();

    await gate.start(() => ({
      kind: "edit",
      messageId: "u0",
      text: "Edited question",
    }));
    await until(() => server.chat.length === 1);
    const [request] = server.chat;
    streamReply(request, { text: "Edited answer", finish: true });
    await until(() => gate.getStatus().phase === "idle");

    expect(request.body).toMatchObject({
      trigger: "submit-message",
      messageId: "u0",
      message: { parts: [{ type: "text", text: "Edited question" }] },
    });
    expect(request.body.turnId).toMatch(UUID);
    expect(shown(gate)).toEqual([
      "user: Edited question",
      "assistant: Edited answer",
    ]);
  });

  test("that edits a message with a file sends the file with the edited text", async () => {
    const photo = {
      type: "file" as const,
      mediaType: "image/png",
      url: "https://utfs.io/f/photo.png",
      filename: "photo.png",
    };
    const question: ChatMessage = {
      id: "u0",
      role: "user",
      parts: [photo, { type: "text", text: "What is this?" }],
    };
    const { gate, server } = openChat([question, ANSWER]);

    await gate.start(() => ({
      kind: "edit",
      messageId: "u0",
      text: "What is in this photo?",
    }));
    await until(() => server.chat.length === 1);

    expect(server.chat[0].body.message).toMatchObject({
      id: "u0",
      parts: [photo, { type: "text", text: "What is in this photo?" }],
    });
  });

  test("that ends after its chat closed is still settled, so its text can go back to that chat", async () => {
    let mounted = true;
    const { calls, gate, server } = openChat(undefined, {
      isMounted: () => mounted,
    });

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    mounted = false;
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].respond(settled([QUESTION, ANSWER], false));
    await until(() => gate.getStatus().phase === "idle");

    expect(calls).toEqual(["handed back append, told"]);
  });

  test("that the server answered and that ends after its chat closed is left for the server to save", async () => {
    let mounted = true;
    const { gate, server } = openChat(undefined, {
      isMounted: () => mounted,
    });

    await ask(gate, "Tell me a story");
    await until(() => server.chat.length === 1);
    streamReply(server.chat[0], { text: "Once upon", finish: false });
    await until(() => shown(gate).at(-1) === "assistant: Once upon");
    mounted = false;
    gate.chat.stop();
    await until(() => gate.getStatus().phase === "idle");

    expect(server.settle).toHaveLength(0);
  });

  test("whose saved chat the settle can't find keeps the thread on screen", async () => {
    const { calls, gate, server } = openChat();

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].respond(errorResponse(404, "not_found:chat"));
    await until(() => gate.getStatus().phase === "idle");

    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
    ]);
    expect(calls).toEqual(["handed back append, told, maybe saved"]);
  });

  test("stopped and then refused hands its text back and shows why, without a settle", async () => {
    const { calls, gate, server } = openChat([]);
    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);

    gate.chat.stop();
    server.chat[0].respond(errorResponse(400, "bad_request:api"));
    await until(() => gate.getStatus().phase === "idle");

    expect(server.settle).toHaveLength(0);
    expect(calls).toEqual([
      "new chat sent",
      "error shown",
      "handed back append",
      "new chat refused",
    ]);
  });
});

describe("a new chat's id", () => {
  test("is given back when the server refuses the first send", async () => {
    const { calls, gate, server } = openChat([]);

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].respond(errorResponse(400, "bad_request:api"));
    await until(() => gate.getStatus().phase === "idle");

    expect(calls).toEqual([
      "new chat sent",
      "error shown",
      "handed back append",
      "new chat refused",
    ]);
  });

  test("stays taken when the server answered and the chat closed before the turn ended", async () => {
    let mounted = true;
    const { calls, gate, server } = openChat([], {
      isMounted: () => mounted,
    });

    await ask(gate, "Tell me a story");
    await until(() => server.chat.length === 1);
    streamReply(server.chat[0], { text: "Once upon", finish: false });
    await until(() => shown(gate).at(-1) === "assistant: Once upon");
    mounted = false;
    gate.chat.stop();
    await until(() => gate.getStatus().phase === "idle");

    expect(calls).toEqual(["new chat sent", "chat saved"]);
  });

  test("stays taken when the settle finds the chat", async () => {
    const { calls, gate, server } = openChat([]);

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].respond(settled(gate.chat.messages.slice(-1), true));
    await until(() => gate.getStatus().phase === "idle");

    expect(calls).toEqual(["new chat sent", "chat saved"]);
  });

  test("stays taken while its settle fails", async () => {
    const { calls, gate, server } = openChat([]);

    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].fail(new TypeError("Failed to fetch"));
    await until(() => gate.getStatus().phase === "unsettled");

    expect(calls).toEqual(["new chat sent"]);
  });

  test("stays taken when a later turn in the saved chat is handed back", async () => {
    const { calls, gate, server } = openChat([]);
    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    streamReply(server.chat[0], { text: "Hi there", finish: true });
    await until(() => gate.getStatus().phase === "idle");

    await ask(gate, "And again");
    await until(() => server.chat.length === 2);
    server.chat[1].respond(errorResponse(400, "bad_request:api"));
    await until(() => gate.getStatus().phase === "idle");

    expect(calls).toEqual([
      "new chat sent",
      "chat saved",
      "finished",
      "error shown",
      "handed back append",
    ]);
  });
});

describe("a chat that Back or Forward restores", () => {
  const restore = (payload: ChatMessage[], savedThreads: SavedThreads) =>
    openChat(payload, {}, savedThreads);

  async function chatWithFollowUp() {
    const payload = [QUESTION, ANSWER];
    const savedThreads = createSavedThreads();
    const { gate, server } = openChat(payload, {}, savedThreads);
    await ask(gate, "Follow-up");
    await until(() => server.chat.length === 1);
    streamReply(server.chat[0], { text: "Second answer", finish: true });
    await until(() => gate.getStatus().phase === "idle");
    return { payload, saved: gate.chat.messages, savedThreads };
  }

  const FOLLOWED_UP = [
    "user: Earlier question",
    "assistant: Earlier answer",
    "user: Follow-up",
    "assistant: Second answer",
  ];

  test("shows the turns this tab saw since the router cached it", async () => {
    const { payload, saved, savedThreads } = await chatWithFollowUp();

    const { gate, server } = restore(payload, savedThreads);

    expect(shown(gate)).toEqual(FOLLOWED_UP);
    await until(() => server.threads.length === 1);
    server.threads[0].respond(Response.json({ messages: saved }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(shown(gate)).toEqual(FOLLOWED_UP);
  });

  test("shows what the server saved after the tab left", async () => {
    const { payload, saved, savedThreads } = await chatWithFollowUp();
    const { gate, server } = restore(payload, savedThreads);

    await until(() => server.threads.length === 1);
    server.threads[0].respond(
      Response.json({
        messages: [
          ...saved,
          message("u2", "user", "From another tab"),
          message("a2", "assistant", "Its answer"),
        ],
      })
    );

    await until(() => gate.chat.messages.length === 6);
    expect(shown(gate).slice(4)).toEqual([
      "user: From another tab",
      "assistant: Its answer",
    ]);
  });

  test("keeps a turn that started before the server answered", async () => {
    const { payload, saved, savedThreads } = await chatWithFollowUp();
    const { gate, server } = restore(payload, savedThreads);

    await ask(gate, "Third question");
    await until(() => server.chat.length === 1);
    server.threads[0].respond(Response.json({ messages: saved }));
    streamReply(server.chat[0], { text: "Third answer", finish: true });
    await until(() => gate.getStatus().phase === "idle");
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(shown(gate)).toEqual([
      ...FOLLOWED_UP,
      "user: Third question",
      "assistant: Third answer",
    ]);
  });

  test("is not rechecked when the router fetched a new payload", async () => {
    const { savedThreads } = await chatWithFollowUp();

    const { gate, server } = openChat(
      [QUESTION, ANSWER, message("u1", "user", "Follow-up")],
      {},
      savedThreads
    );

    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
      "user: Follow-up",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(server.threads).toHaveLength(0);
  });
});

describe("a stop before the response", () => {
  test("in a saved chat ends the request at once and settles the turn", async () => {
    const { gate, server } = openChat();
    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    const [request] = server.chat;

    gate.chat.stop();

    expect(request.signal?.aborted).toBe(true);
    await until(() => server.settle.length === 1);
    expect(server.settle[0].body).toEqual({
      turnId: request.body.turnId,
      expectReply: false,
    });
  });

  test("in a new chat says it is stopping and waits for the server's answer, however long it takes", async () => {
    const { gate, server } = openChat([]);
    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    const [request] = server.chat;

    jest.useFakeTimers();
    gate.chat.stop();
    const status = gate.getStatus();
    jest.advanceTimersByTime(60_000);
    jest.useRealTimers();

    expect(status).toEqual({ phase: "running", stopping: true });
    expect(request.signal?.aborted).toBe(false);
    expect(server.settle).toHaveLength(0);
    streamReply(request, { finish: false });
    await until(() => server.settle.length === 1);
    expect(request.signal?.aborted).toBe(true);
    server.settle[0].respond(settled([message("u1", "user", "Hello")], true));
    await until(() => gate.getStatus().phase === "idle");
    expect(shown(gate)).toEqual(["user: Hello"]);
  });
});

describe("a send while a turn settles", () => {
  const dropBeforeText = async (
    gate: TurnGate,
    server: ReturnType<typeof fakeServer>
  ) => {
    await ask(gate, "Tell me a story");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
  };

  test("goes out once the settle shows the earlier turn saved", async () => {
    const { gate, server } = openChat();
    await dropBeforeText(gate, server);
    const [userTurn] = gate.chat.messages.slice(-1);

    const followUp = ask(gate, "A short one");
    await Promise.resolve();
    expect(server.chat).toHaveLength(1);
    server.settle[0].respond(settled([QUESTION, ANSWER, userTurn], true));
    await followUp;
    await until(() => server.chat.length === 2);

    expect(server.chat[1].body.message).toMatchObject({
      parts: [{ type: "text", text: "A short one" }],
    });
  });

  test("shows that it is held, and a second send meanwhile is ignored", async () => {
    const { gate, server } = openChat();
    await dropBeforeText(gate, server);
    const [userTurn] = gate.chat.messages.slice(-1);
    let prepared = 0;
    const prepare = () => {
      prepared += 1;
      return { kind: "append" as const, files: [], text: "A short one" };
    };

    const followUp = gate.start(prepare);
    const whileHeld = gate.getStatus();
    await gate.start(prepare);
    server.settle[0].respond(settled([QUESTION, ANSWER, userTurn], true));
    await followUp;

    expect(whileHeld).toEqual({ phase: "settling", sendHeld: true });
    expect(prepared).toBe(1);
    expect(gate.getStatus()).toEqual({ phase: "running", stopping: false });
  });

  test("that went out lets the next send go out too", async () => {
    const { gate, server } = openChat();
    await dropBeforeText(gate, server);
    const [userTurn] = gate.chat.messages.slice(-1);
    const followUp = ask(gate, "A short one");
    server.settle[0].respond(settled([QUESTION, ANSWER, userTurn], true));
    await followUp;
    await until(() => server.chat.length === 2);
    streamReply(server.chat[1], { text: "Once.", finish: true });
    await until(() => gate.getStatus().phase === "idle");

    await ask(gate, "Another one");
    await until(() => server.chat.length === 3);

    expect(server.chat[2].body.message).toMatchObject({
      parts: [{ type: "text", text: "Another one" }],
    });
  });

  test("never goes out once its chat has closed", async () => {
    let mounted = true;
    const { calls, gate, server } = openChat(undefined, {
      isMounted: () => mounted,
    });
    await dropBeforeText(gate, server);
    const [userTurn] = gate.chat.messages.slice(-1);
    let prepared = false;

    const followUp = gate.start(() => {
      prepared = true;
      return { kind: "append", files: [], text: "A short one" };
    });
    mounted = false;
    server.settle[0].respond(settled([QUESTION, ANSWER, userTurn], true));
    await followUp;

    expect(prepared).toBe(false);
    expect(server.chat).toHaveLength(1);
    expect(calls).toEqual([]);
  });

  test("never goes out when the earlier text comes back to the composer", async () => {
    const { calls, gate, server } = openChat();
    await dropBeforeText(gate, server);
    let prepared = false;

    const followUp = gate.start(() => {
      prepared = true;
      return { kind: "append", files: [], text: "A short one" };
    });
    server.settle[0].respond(settled([QUESTION, ANSWER], false));
    await followUp;

    expect(prepared).toBe(false);
    expect(server.chat).toHaveLength(1);
    expect(calls).toEqual(["handed back append, told"]);
  });
});

describe("a settle that fails", () => {
  const failSettle = async () => {
    const opened = openChat();
    const { gate, server } = opened;
    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].fail(new TypeError("Failed to fetch"));
    await until(() => gate.getStatus().phase === "unsettled");
    return opened;
  };

  test("leaves the turn unsettled until it is tried again", async () => {
    const { gate, server } = await failSettle();
    const [userTurn] = gate.chat.messages.slice(-1);

    gate.retry();
    await until(() => server.settle.length === 2);
    server.settle[1].respond(settled([QUESTION, ANSWER, userTurn], true));
    await until(() => gate.getStatus().phase === "idle");

    expect(shown(gate).at(-1)).toBe("user: Hello");
  });

  test("is tried again before a new send goes out", async () => {
    const { gate, server } = await failSettle();
    const [userTurn] = gate.chat.messages.slice(-1);

    const followUp = ask(gate, "A short one");
    await until(() => server.settle.length === 2);
    expect(server.chat).toHaveLength(1);
    server.settle[1].respond(settled([QUESTION, ANSWER, userTurn], true));
    await followUp;
    await until(() => server.chat.length === 2);
  });

  test("shows the check when it is tried again, and a second try meanwhile sends nothing", async () => {
    const { gate, server } = await failSettle();

    gate.retry();
    const whileChecking = gate.getStatus();
    gate.retry();

    expect(whileChecking).toEqual({ phase: "settling", sendHeld: false });
    expect(server.settle).toHaveLength(2);
  });

  test("names the new reason when a second try fails differently", async () => {
    const { gate, server } = await failSettle();

    gate.retry();
    await until(() => server.settle.length === 2);
    server.settle[1].respond(errorResponse(500, "server:api"));
    await until(() => gate.getStatus().phase === "unsettled");

    expect(gate.getStatus()).toEqual({
      phase: "unsettled",
      reason: "server",
      subject: "message",
    });
  });

  test("holds a new send while it is checked again", async () => {
    const { gate, server } = await failSettle();

    const followUp = ask(gate, "A short one");
    const whileChecking = gate.getStatus();
    server.settle[1].respond(
      settled([QUESTION, ANSWER, ...gate.chat.messages.slice(-1)], true)
    );
    await followUp;

    expect(whileChecking).toEqual({ phase: "settling", sendHeld: true });
  });

  test("names an edit it could not confirm", async () => {
    const { gate, server } = openChat();
    await gate.start(() => ({
      kind: "edit",
      messageId: "u0",
      text: "Edited question",
    }));
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].fail(new TypeError("Failed to fetch"));
    await until(() => gate.getStatus().phase === "unsettled");

    expect(gate.getStatus()).toEqual({
      phase: "unsettled",
      reason: "offline",
      subject: "edit",
    });
  });

  test("offline names the message it could not confirm", async () => {
    const { gate } = await failSettle();

    expect(gate.getStatus()).toEqual({
      phase: "unsettled",
      reason: "offline",
      subject: "message",
    });
  });

  test("on the server's side names the reply it could not confirm", async () => {
    const { gate, server } = openChat();
    await ask(gate, "Tell me a story");
    await until(() => server.chat.length === 1);
    streamReply(server.chat[0], { text: "Once upon", finish: false });
    await until(() => shown(gate).at(-1) === "assistant: Once upon");
    gate.chat.stop();
    await until(() => server.settle.length === 1);
    server.settle[0].respond(errorResponse(500, "server:api"));
    await until(() => gate.getStatus().phase === "unsettled");

    expect(gate.getStatus()).toEqual({
      phase: "unsettled",
      reason: "server",
      subject: "reply",
    });
  });

  test("still asks the server to wait for the reply it showed when tried again or when a send checks it", async () => {
    const { gate, server } = openChat();
    await ask(gate, "Tell me a story");
    await until(() => server.chat.length === 1);
    const { turnId } = server.chat[0].body;
    streamReply(server.chat[0], { text: "Once upon", finish: false });
    await until(() => shown(gate).at(-1) === "assistant: Once upon");
    gate.chat.stop();
    await until(() => server.settle.length === 1);
    server.settle[0].fail(new TypeError("Failed to fetch"));
    await until(() => gate.getStatus().phase === "unsettled");

    gate.retry();
    await until(() => server.settle.length === 2);
    server.settle[1].fail(new TypeError("Failed to fetch"));
    await until(() => gate.getStatus().phase === "unsettled");
    const followUp = ask(gate, "A short one");
    await until(() => server.settle.length === 3);
    server.settle[2].fail(new TypeError("Failed to fetch"));
    await followUp;

    expect(server.settle.map(({ body }) => body)).toEqual([
      { turnId, expectReply: true },
      { turnId, expectReply: true },
      { turnId, expectReply: true },
    ]);
  });

  test("of a later turn is tried again for that turn, not an earlier one", async () => {
    const { gate, server } = openChat();
    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);
    server.chat[0].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 1);
    server.settle[0].respond(
      settled([QUESTION, ANSWER, ...gate.chat.messages.slice(-1)], true)
    );
    await until(() => gate.getStatus().phase === "idle");
    await ask(gate, "Are you there?");
    await until(() => server.chat.length === 2);
    const { turnId } = server.chat[1].body;
    server.chat[1].fail(new TypeError("Failed to fetch"));
    await until(() => server.settle.length === 2);
    server.settle[1].fail(new TypeError("Failed to fetch"));
    await until(() => gate.getStatus().phase === "unsettled");

    gate.retry();
    await until(() => server.settle.length === 3);

    expect(server.settle[2].body).toEqual({ turnId, expectReply: false });
  });

  test("again when a send checks it says that the send didn't go out", async () => {
    const { calls, gate, server } = await failSettle();
    let prepared = false;

    const followUp = gate.start(() => {
      prepared = true;
      return { kind: "append", files: [], text: "A short one" };
    });
    await until(() => server.settle.length === 2);
    server.settle[1].fail(new TypeError("Failed to fetch"));
    await followUp;

    expect(prepared).toBe(false);
    expect(calls).toEqual(["send blocked"]);
    expect(gate.getStatus()).toEqual({
      phase: "unsettled",
      reason: "offline",
      subject: "message",
    });
  });
});

test("a failure is a refusal, a lost request, or an error inside the stream", () => {
  expect(turnFailure(new ChatSDKError("bad_request:api"))).toBe("refused");
  expect(turnFailure(new ChatSDKError("forbidden:chat"))).toBe("refused");
  expect(turnFailure(new ChatSDKError("not_found:chat"))).toBe("refused");
  expect(turnFailure(new ChatSDKError("rate_limit:chat"))).toBe("refused");
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

  test("says when the server doesn't have the chat", async () => {
    respondWith(Response.json({ code: "not_found:chat" }, { status: 404 }));

    expect(await requestSettle("chat", "turn", false)).toBe("chat-not-found");
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
    const stopped = message("a1", "assistant", "The rhythmic sweep", {
      model: "chat-5-mini",
      useSearch: true,
    });

    expect(
      adoptThread(
        [stopped],
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
