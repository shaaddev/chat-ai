import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, isFileUIPart } from "ai";
import { ChatSDKError } from "@/lib/errors";
import { pollWhile } from "@/lib/poll";
import type { SavedThreads } from "@/lib/saved-threads";
import type { ChatMessage } from "@/lib/types";
import type { SentFile } from "@/lib/uploadthing/tray";
import {
  fetchWithErrorHandlers,
  generateUUID,
  hasVisibleContent,
} from "@/lib/utils";

// Longer than the server's wait for a reply, so only a hung request times out.
const SETTLE_TIMEOUT_MS = 10_000;

export type TurnFailure = "refused" | "lost" | "stream";

// The chat route answers with a 4xx only before it saves a turn, so a refusal
// saved nothing. A 5xx can come after a save, and a dropped connection or an
// offline error leaves the save unknown.
export function turnFailure(error: unknown): TurnFailure {
  if (error instanceof ChatSDKError) {
    return error.statusCode < 500 ? "refused" : "lost";
  }
  return error instanceof TypeError ? "lost" : "stream";
}

export interface SettledThread {
  messages: ChatMessage[];
  turnSaved: boolean;
}

function parseSettledThread(body: unknown): SettledThread {
  if (
    typeof body === "object" &&
    body !== null &&
    "messages" in body &&
    Array.isArray(body.messages) &&
    "turnSaved" in body &&
    typeof body.turnSaved === "boolean"
  ) {
    return { messages: body.messages, turnSaved: body.turnSaved };
  }
  throw new Error("The settle response has no thread");
}

export async function requestSettle(
  chatId: string,
  turnId: string,
  expectReply: boolean
): Promise<SettledThread | "chat-not-found"> {
  let response: Response;
  try {
    response = await fetchWithErrorHandlers(`/api/chat/${chatId}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnId, expectReply }),
      signal: AbortSignal.timeout(SETTLE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof ChatSDKError && error.type === "not_found") {
      return "chat-not-found";
    }
    throw error;
  }
  return parseSettledThread(await response.json());
}

export function adoptThread(
  shown: readonly ChatMessage[],
  saved: readonly ChatMessage[]
): ChatMessage[] {
  const shownById = new Map(shown.map((message) => [message.id, message]));
  return saved.map((message) => {
    const current = shownById.get(message.id);
    if (!current) {
      return message;
    }
    if (JSON.stringify(current.parts) === JSON.stringify(message.parts)) {
      return current;
    }
    return {
      ...message,
      metadata: { ...current.metadata, ...message.metadata },
    };
  });
}

async function requestThread(
  chatId: string
): Promise<ChatMessage[] | undefined> {
  const response = await fetch(`/api/chats/${chatId}`).catch(() => undefined);
  const body: unknown = response?.ok
    ? await response.json().catch(() => undefined)
    : undefined;
  if (
    typeof body === "object" &&
    body !== null &&
    "messages" in body &&
    Array.isArray(body.messages)
  ) {
    return body.messages;
  }
}

const isBehind = (saved: ChatMessage[], shown: ChatMessage[]) =>
  saved.length < shown.length &&
  saved.every((message, index) => message.id === shown[index].id);

// A reply saves when its stream ends, which can come after the tab showed
// it and after a restored chat asks.
const SAVED_REPLY_WAIT_MS = 5000;

export type TurnRequest =
  | { kind: "append"; files: SentFile[]; text: string }
  | { kind: "edit"; messageId: string; text: string }
  | { kind: "regenerate" };

export type NewChatSend = "sent" | "refused" | "lost";

export type SettleFailure = "offline" | "server";

export type UnsettledSubject = "edit" | "message" | "regeneration" | "reply";

export type TurnStatus =
  | { phase: "idle" }
  | { phase: "running"; stopping: boolean }
  | { phase: "settling"; sendHeld: boolean }
  | { phase: "unsettled"; reason: SettleFailure; subject: UnsettledSubject };

export interface TurnEffects {
  chatSaved: (request: TurnRequest) => void;
  isMounted: () => boolean;
  newChatSend: (send: NewChatSend) => void;
  refreshChats: () => void;
  sendBlocked: () => void;
  showError: (error: Error) => void;
  turnFinished: (reply: ChatMessage, keptPrevious: boolean) => void;
  turnNotSaved: (
    request: TurnRequest,
    options: { editShown: boolean; maybeSaved: boolean; notify: boolean }
  ) => void;
}

export interface TurnGate {
  chat: Chat<ChatMessage>;
  getStatus: () => TurnStatus;
  onScreen: () => void;
  retry: () => void;
  start: (prepare: () => TurnRequest | undefined) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
}

interface Turn {
  id: string;
  replacedReply: ChatMessage | undefined;
  request: TurnRequest;
}

interface Ended {
  expectReply: boolean;
  shown: ChatMessage[];
  turn: Turn;
}

type SettleResult = "settled" | "handed-back" | "failed";

interface Settling {
  ended: Ended;
  phase: "settling";
  result: Promise<SettleResult>;
  sendHeld: boolean;
}

interface Unsettled {
  ended: Ended;
  phase: "unsettled";
  reason: SettleFailure;
}

type Phase =
  | { phase: "idle" }
  | {
      phase: "running";
      turn: Turn;
      answered: boolean;
      refusal: ChatSDKError | undefined;
      stopping: boolean;
    }
  | Settling
  | Unsettled;

const IDLE: Phase = { phase: "idle" };

const settleFailure = (error: unknown): SettleFailure =>
  error instanceof TypeError ||
  (error instanceof ChatSDKError && error.type === "offline")
    ? "offline"
    : "server";

const SUBJECT_BY_KIND: Record<TurnRequest["kind"], UnsettledSubject> = {
  append: "message",
  edit: "edit",
  regenerate: "regeneration",
};

const subjectOf = ({ expectReply, turn }: Ended): UnsettledSubject =>
  expectReply ? "reply" : SUBJECT_BY_KIND[turn.request.kind];

function statusOf(phase: Phase): TurnStatus {
  switch (phase.phase) {
    case "running":
      return { phase: "running", stopping: phase.stopping };
    case "settling":
      return { phase: "settling", sendHeld: phase.sendHeld };
    case "unsettled":
      return {
        phase: "unsettled",
        reason: phase.reason,
        subject: subjectOf(phase.ended),
      };
    default:
      return { phase: "idle" };
  }
}

const sameStatus = (a: TurnStatus, b: TurnStatus) =>
  JSON.stringify(a) === JSON.stringify(b);

function userMessage({ files, text }: { files: SentFile[]; text: string }) {
  return {
    role: "user" as const,
    parts: [
      ...files.map((file) => ({ type: "file" as const, ...file })),
      ...(text ? [{ type: "text" as const, text }] : []),
    ],
  };
}

export function createTurnGate({
  chatId,
  initialMessages,
  savedThreads,
  requestSettings,
  effects,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
  savedThreads: SavedThreads;
  requestSettings: () => Record<string, unknown>;
  effects: TurnEffects;
}): TurnGate {
  const opened = savedThreads.open(chatId, initialMessages);
  let phase: Phase = IDLE;
  let status = statusOf(phase);
  let chatExists = opened.thread.length > 0;
  let savedThread = opened.thread;
  let { restored } = opened;
  const listeners = new Set<() => void>();

  const keep = (thread: ChatMessage[]) => {
    savedThread = thread;
    savedThreads.save(chatId, thread);
  };

  const commit = (next: Phase) => {
    phase = next;
    const nextStatus = statusOf(phase);
    if (sameStatus(status, nextStatus)) {
      return;
    }
    status = nextStatus;
    for (const listener of listeners) {
      listener();
    }
  };

  const isRunning = (turn: Turn) =>
    phase.phase === "running" && phase.turn === turn;

  const setChatExists = (exists: boolean, request: TurnRequest) => {
    if (exists === chatExists) {
      return;
    }
    chatExists = exists;
    if (exists) {
      effects.chatSaved(request);
    }
  };

  const updateRunning = (
    turn: Turn,
    change: Partial<{
      answered: boolean;
      refusal: ChatSDKError;
      stopping: boolean;
    }>
  ) => {
    if (phase.phase === "running" && phase.turn === turn) {
      commit({ ...phase, ...change });
    }
  };

  const fetchTurn = async (
    input: RequestInfo | URL,
    init: RequestInit | undefined
  ): Promise<Response> => {
    const turn = phase.phase === "running" ? phase.turn : undefined;
    const stopped = init?.signal;
    const request = new AbortController();
    const stop = () => {
      if (chatExists) {
        request.abort();
      } else if (turn) {
        updateRunning(turn, { stopping: true });
      }
    };
    if (stopped?.aborted) {
      stop();
    }
    stopped?.addEventListener("abort", stop, { once: true });
    try {
      const response = await fetchWithErrorHandlers(input, {
        ...init,
        signal: request.signal,
      });
      if (turn && isRunning(turn)) {
        updateRunning(turn, { answered: true });
        setChatExists(true, turn.request);
      }
      if (stopped?.aborted) {
        request.abort();
      }
      return response;
    } catch (error) {
      if (
        turn &&
        error instanceof ChatSDKError &&
        turnFailure(error) === "refused"
      ) {
        updateRunning(turn, { refusal: error });
      }
      throw error;
    }
  };

  const showSaved = (thread: ChatMessage[], request: TurnRequest) => {
    keep(thread);
    chat.messages = thread;
    setChatExists(thread.length > 0, request);
    commit(IDLE);
    effects.refreshChats();
  };

  const handBack = (
    turn: Turn,
    thread: ChatMessage[],
    { maybeSaved, notify }: { maybeSaved: boolean; notify: boolean }
  ) => {
    const { request } = turn;
    const editShown =
      request.kind === "edit" &&
      thread.some(({ id }) => id === request.messageId);
    effects.turnNotSaved(request, { editShown, maybeSaved, notify });
    return request.kind !== "regenerate";
  };

  const settle = (ended: Ended, sendHeld = false): Promise<SettleResult> => {
    const { expectReply, shown, turn } = ended;
    const result = requestSettle(chatId, turn.id, expectReply).then(
      (settled): SettleResult => {
        const chatFound = settled !== "chat-not-found";
        let saved: ChatMessage[] = [];
        if (chatFound) {
          saved = settled.messages;
        } else if (chatExists) {
          saved = savedThread;
        }
        const thread = adoptThread(shown, saved);
        showSaved(thread, turn.request);
        if (chatFound && settled.turnSaved) {
          return "settled";
        }
        if (!(chatFound || chatExists)) {
          effects.newChatSend("lost");
        }
        const handedBack = handBack(turn, thread, {
          maybeSaved: !chatFound,
          notify: true,
        });
        return handedBack ? "handed-back" : "settled";
      },
      (error): SettleResult => {
        commit({ phase: "unsettled", ended, reason: settleFailure(error) });
        return "failed";
      }
    );
    commit({ phase: "settling", ended, result, sendHeld });
    return result;
  };

  const holdSend = (pending: Settling | Unsettled) => {
    if (pending.phase === "unsettled") {
      return settle(pending.ended, true);
    }
    commit({ ...pending, sendHeld: true });
    return pending.result;
  };

  const finish = (turn: Turn, reply: ChatMessage, shown: ChatMessage[]) => {
    const keptReply = hasVisibleContent(reply) ? undefined : turn.replacedReply;
    const thread = keptReply
      ? [...shown.filter(({ id }) => id !== reply.id), keptReply]
      : shown;
    keep(thread);
    if (keptReply) {
      chat.messages = thread;
    }
    commit(IDLE);
    effects.turnFinished(reply, keptReply !== undefined);
    effects.refreshChats();
  };

  const turnEnded = ({
    message: reply,
    messages: shown,
    isAbort,
    isError,
  }: {
    message: ChatMessage;
    messages: ChatMessage[];
    isAbort: boolean;
    isError: boolean;
  }) => {
    if (phase.phase !== "running") {
      effects.refreshChats();
      return;
    }
    const { answered, turn, refusal } = phase;
    // AI SDK's Chat skips onError for an aborted request, so a refusal that
    // lands after a stop shows here.
    if (refusal) {
      if (isAbort) {
        effects.showError(refusal);
      }
      const thread = adoptThread(shown, savedThread);
      showSaved(thread, turn.request);
      handBack(turn, thread, { maybeSaved: false, notify: false });
      if (!chatExists) {
        effects.newChatSend("refused");
      }
    } else if (answered && !effects.isMounted()) {
      keep(shown);
      commit(IDLE);
      effects.refreshChats();
    } else if (isAbort || isError) {
      settle({ turn, shown, expectReply: hasVisibleContent(reply) });
    } else {
      finish(turn, reply, shown);
    }
  };

  const send = (turn: Turn) => {
    const body = { turnId: turn.id };
    const { request } = turn;
    if (request.kind === "regenerate") {
      return chat.regenerate({ body });
    }
    if (request.kind === "edit") {
      const edited = chat.messages.find(({ id }) => id === request.messageId);
      return chat.sendMessage(
        {
          text: request.text,
          files: edited?.parts.filter(isFileUIPart) ?? [],
          messageId: request.messageId,
        },
        { body }
      );
    }
    return chat.sendMessage(userMessage(request), { body });
  };

  const chat: Chat<ChatMessage> = new Chat<ChatMessage>({
    id: chatId,
    messages: opened.thread,
    generateId: generateUUID,
    transport: new DefaultChatTransport<ChatMessage>({
      api: "/api/chat",
      fetch: fetchTurn,
      prepareSendMessagesRequest: ({
        body,
        id,
        messageId,
        messages,
        trigger,
      }) => ({
        body: {
          ...requestSettings(),
          ...body,
          id,
          message: messages.at(-1),
          trigger,
          messageId,
        },
      }),
    }),
    onError: (error) => {
      if (turnFailure(error) !== "lost") {
        effects.showError(error);
      }
    },
    onFinish: turnEnded,
  });

  const start = async (prepare: () => TurnRequest | undefined) => {
    const pending = phase;
    if (
      pending.phase === "running" ||
      (pending.phase === "settling" && pending.sendHeld)
    ) {
      return;
    }
    if (pending.phase !== "idle") {
      const result = await holdSend(pending);
      if (!effects.isMounted()) {
        return;
      }
      if (phase.phase === "unsettled") {
        effects.sendBlocked();
      }
      if (result !== "settled" || phase.phase !== "idle") {
        return;
      }
    }
    const request = prepare();
    if (!request) {
      return;
    }
    if (!chatExists) {
      effects.newChatSend("sent");
    }
    const last = chat.messages.at(-1);
    const turn: Turn = {
      id: generateUUID(),
      request,
      replacedReply:
        request.kind === "regenerate" &&
        last?.role === "assistant" &&
        hasVisibleContent(last)
          ? last
          : undefined,
    };
    commit({
      phase: "running",
      turn,
      answered: false,
      refusal: undefined,
      stopping: false,
    });
    send(turn).catch(() => {
      if (isRunning(turn)) {
        commit(IDLE);
      }
    });
  };

  const syncRestoredThread = async () => {
    const shown = chat.messages;
    const untouched = () => phase.phase === "idle" && chat.messages === shown;
    let saved: ChatMessage[] | undefined;
    await pollWhile(async () => {
      saved = await requestThread(chatId);
      return saved !== undefined && untouched() && isBehind(saved, shown);
    }, Date.now() + SAVED_REPLY_WAIT_MS);
    if (saved && untouched()) {
      const thread = adoptThread(shown, saved);
      keep(thread);
      chat.messages = thread;
    }
  };

  return {
    chat,
    getStatus: () => status,
    onScreen: () => {
      savedThreads.shown(chatId, initialMessages);
      if (restored) {
        restored = false;
        syncRestoredThread();
      }
    },
    retry: () => {
      if (phase.phase === "unsettled") {
        settle(phase.ended);
      }
    },
    start,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
