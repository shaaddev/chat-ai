/// <reference types="bun-types/test" />
import { afterEach, describe, expect, jest, test } from "bun:test";
import {
  adoptThread,
  createTurnGate,
  joinDraftText,
  requestSettle,
  type TurnEffects,
  type TurnGate,
  turnFailure,
} from "./chat-turn";
import { ChatSDKError } from "./errors";
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

// Holds every request until the test answers it, the way a slow server would.
function fakeServer() {
  const chat: HeldRequest[] = [];
  const settle: HeldRequest[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? undefined;
      signal?.addEventListener("abort", () => reject(signal.reason));
      (String(input).endsWith("/settle") ? settle : chat).push({
        body: JSON.parse(String(init?.body ?? "{}")),
        fail: reject,
        respond: resolve,
        signal,
      });
    })) as typeof fetch;
  return { chat, settle };
}

const UUID = /^[0-9a-f-]{36}$/;
const encoder = new TextEncoder();

// Answers a chat request with a reply stream that the request's abort ends,
// as a real response body would.
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
    refreshChats: () => undefined,
    sendBlocked: (reason) => calls.push(`send blocked: ${reason}`),
    showError: () => calls.push("error shown"),
    turnFinished: (_, keptPrevious) =>
      calls.push(keptPrevious ? "finished, kept the old reply" : "finished"),
    turnNotSaved: (request, { notify }) => {
      calls.push(`handed back ${request.kind}${notify ? ", told" : ""}`);
    },
    ...overrides,
  };
  return { calls, effects };
}

const QUESTION = message("u0", "user", "Earlier question");
const ANSWER = message("a0", "assistant", "Earlier answer");

function openChat(
  initialMessages: ChatMessage[] = [QUESTION, ANSWER],
  overrides: Partial<TurnEffects> = {}
) {
  const server = fakeServer();
  const { calls, effects } = recordingEffects(overrides);
  const gate = createTurnGate({
    chatId: "chat",
    initialMessages,
    requestSettings: () => ({ selectedChatModel: "chat-5-mini" }),
    effects,
  });
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
    expect(calls).toEqual(["chat saved", "finished"]);
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

  test("that regenerates into an empty reply keeps the reply it would replace", async () => {
    const { calls, gate, server } = openChat();

    await gate.start(() => ({ kind: "regenerate" }));
    await until(() => server.chat.length === 1);
    expect(server.chat[0].body.trigger).toBe("regenerate-message");
    streamReply(server.chat[0], { finish: true });
    await until(() => gate.getStatus().phase === "idle");

    expect(shown(gate)).toEqual([
      "user: Earlier question",
      "assistant: Earlier answer",
    ]);
    expect(calls).toEqual(["finished, kept the old reply"]);
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
    expect(calls).toEqual(["handed back append, told"]);
  });

  test("stopped and then refused hands its text back and shows why, without a settle", async () => {
    const { calls, gate, server } = openChat([]);
    await ask(gate, "Hello");
    await until(() => server.chat.length === 1);

    gate.chat.stop();
    server.chat[0].respond(errorResponse(400, "bad_request:api"));
    await until(() => gate.getStatus().phase === "idle");

    expect(server.settle).toHaveLength(0);
    expect(calls).toEqual(["error shown", "handed back append"]);
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

    expect(whileHeld).toEqual({ phase: "settling", held: true });
    expect(prepared).toBe(1);
    expect(gate.getStatus()).toEqual({ phase: "running", stopping: false });
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

    expect(whileChecking).toEqual({ phase: "settling", held: false });
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

    expect(whileChecking).toEqual({ phase: "settling", held: true });
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

  test("again when a send checks it says why the send didn't go out", async () => {
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
    expect(calls).toEqual(["send blocked: offline"]);
    expect(gate.getStatus().phase).toBe("unsettled");
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

  test("answers null for a chat the server doesn't have", async () => {
    respondWith(Response.json({ code: "not_found:chat" }, { status: 404 }));

    expect(await requestSettle("chat", "turn", false)).toBeNull();
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

test("restored text goes in front of anything typed since", () => {
  expect(joinDraftText("Unsent question", "")).toBe("Unsent question");
  expect(joinDraftText("Unsent question", "Follow-up")).toBe(
    "Unsent question\n\nFollow-up"
  );
  expect(joinDraftText("", "Follow-up")).toBe("Follow-up");
});
