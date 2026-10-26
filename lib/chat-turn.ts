import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, isFileUIPart } from "ai";
import { ChatSDKError } from "@/lib/errors";
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

// Null when the server has no such chat for this user.
export async function requestSettle(
  chatId: string,
  turnId: string,
  expectReply: boolean
): Promise<SettledThread | null> {
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
      return null;
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

export function joinDraftText(restored: string, typed: string): string {
  if (!typed.trim()) {
    return restored;
  }
  if (!restored.trim()) {
    return typed;
  }
  return `${restored}\n\n${typed}`;
}

export type TurnRequest =
  | { kind: "append"; files: SentFile[]; text: string }
  | { kind: "edit"; messageId: string; text: string }
  | { kind: "regenerate" };

export type SettleFailure = "offline" | "server";

// What an unsettled turn could not confirm: the reply on screen, the user's
// message, or a regenerate that showed no text yet.
export type UnsettledSubject = "message" | "regeneration" | "reply";

export type TurnStatus =
  | { phase: "idle" }
  | { phase: "running"; stopping: boolean }
  | { phase: "settling"; held: boolean }
  | { phase: "unsettled"; reason: SettleFailure; subject: UnsettledSubject };

export interface TurnEffects {
  // The server has the chat now, after its first saved turn.
  chatSaved: (request: TurnRequest) => void;
  isMounted: () => boolean;
  refreshChats: () => void;
  // A send waited on a settle that failed, so it didn't go out.
  sendBlocked: (reason: SettleFailure) => void;
  showError: (error: Error) => void;
  turnFinished: (reply: ChatMessage, keptPrevious: boolean) => void;
  // Give the request's text back to where the user typed it.
  turnNotSaved: (
    request: TurnRequest,
    options: { editShown: boolean; notify: boolean }
  ) => void;
}

export interface TurnGate {
  chat: Chat<ChatMessage>;
  getStatus: () => TurnStatus;
  retry: () => void;
  // `prepare` runs once an earlier turn has settled, so what it reads, such as
  // the attachment tray, is current. It returns nothing when there is nothing
  // to send.
  start: (prepare: () => TurnRequest | undefined) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
}

interface Turn {
  id: string;
  // The reply a regenerate replaces, which the server keeps if the new one
  // comes back empty.
  replacedReply: ChatMessage | undefined;
  request: TurnRequest;
}

interface Ended {
  // The screen showed reply text, so the turn's request may still be saving it.
  expectReply: boolean;
  shown: ChatMessage[];
  turn: Turn;
}

type SettleResult = "settled" | "handed-back" | "failed";

type Phase =
  | { phase: "idle" }
  | {
      phase: "running";
      turn: Turn;
      refusal: ChatSDKError | undefined;
      stopping: boolean;
    }
  | { phase: "settling"; ended: Ended; result: Promise<SettleResult> }
  | { phase: "unsettled"; ended: Ended; reason: SettleFailure };

const IDLE: Phase = { phase: "idle" };

const settleFailure = (error: unknown): SettleFailure =>
  error instanceof TypeError ||
  (error instanceof ChatSDKError && error.type === "offline")
    ? "offline"
    : "server";

const subjectOf = ({ expectReply, turn }: Ended): UnsettledSubject => {
  if (expectReply) {
    return "reply";
  }
  return turn.request.kind === "regenerate" ? "regeneration" : "message";
};

function statusOf(phase: Phase, held: boolean): TurnStatus {
  switch (phase.phase) {
    case "running":
      return { phase: "running", stopping: phase.stopping };
    case "settling":
      return { phase: "settling", held };
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
  requestSettings,
  effects,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
  requestSettings: () => Record<string, unknown>;
  effects: TurnEffects;
}): TurnGate {
  let phase: Phase = IDLE;
  // A send is waiting for the settle before it goes out.
  let held = false;
  let status = statusOf(phase, held);
  let chatExists = initialMessages.length > 0;
  // The thread as the server last saved it.
  let savedThread = initialMessages;
  const listeners = new Set<() => void>();

  const publish = () => {
    const nextStatus = statusOf(phase, held);
    if (sameStatus(status, nextStatus)) {
      return;
    }
    status = nextStatus;
    for (const listener of listeners) {
      listener();
    }
  };

  const commit = (next: Phase) => {
    phase = next;
    publish();
  };

  const setHeld = (next: boolean) => {
    held = next;
    publish();
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
    change: Partial<{ refusal: ChatSDKError; stopping: boolean }>
  ) => {
    if (phase.phase === "running" && phase.turn === turn) {
      commit({ ...phase, ...change });
    }
  };

  // In a saved chat a stop ends the request at once: the settle claims the
  // turn, so the request fails if it reaches the server later. A chat the
  // server doesn't have yet has no row to claim the turn in, so the stop
  // waits for the server's answer, which comes only after it saves or
  // refuses the turn.
  const fetchTurn = async (
    input: RequestInfo | URL,
    init: RequestInit | undefined
  ): Promise<Response> => {
    const turn = phase.phase === "running" ? phase.turn : undefined;
    const stopped = init?.signal;
    const request = new AbortController();
    let answered = false;
    const stop = () => {
      if (answered || chatExists) {
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
      answered = true;
      if (turn && isRunning(turn)) {
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
    savedThread = thread;
    chat.messages = thread;
    setChatExists(thread.length > 0, request);
    commit(IDLE);
    effects.refreshChats();
  };

  const handBack = (turn: Turn, thread: ChatMessage[], notify: boolean) => {
    const { request } = turn;
    const editShown =
      request.kind === "edit" &&
      thread.some(({ id }) => id === request.messageId);
    effects.turnNotSaved(request, { editShown, notify });
    // A regenerate has no text to give back.
    return request.kind !== "regenerate";
  };

  const settle = (ended: Ended): Promise<SettleResult> => {
    const { expectReply, shown, turn } = ended;
    const result = requestSettle(chatId, turn.id, expectReply).then(
      (settled): SettleResult => {
        // A chat the settle can't find is gone or not this user's. Either
        // way the turn saved nothing, so the screen keeps what saved before.
        const saved = settled?.messages ?? (chatExists ? savedThread : []);
        const thread = adoptThread(shown, saved);
        showSaved(thread, turn.request);
        if (settled?.turnSaved) {
          return "settled";
        }
        return handBack(turn, thread, true) ? "handed-back" : "settled";
      },
      (error): SettleResult => {
        commit({ phase: "unsettled", ended, reason: settleFailure(error) });
        return "failed";
      }
    );
    commit({ phase: "settling", ended, result });
    return result;
  };

  const finish = (turn: Turn, reply: ChatMessage, shown: ChatMessage[]) => {
    // The server keeps the old reply when a regenerated one comes back empty.
    const kept = hasVisibleContent(reply) ? undefined : turn.replacedReply;
    const thread = kept
      ? [...shown.filter(({ id }) => id !== reply.id), kept]
      : shown;
    savedThread = thread;
    if (kept) {
      chat.messages = thread;
    }
    commit(IDLE);
    effects.turnFinished(reply, kept !== undefined);
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
    const { turn, refusal } = phase;
    // A refusal saved nothing, even after a stop. The chat instance skips
    // its error callback for a stopped request, so that refusal shows here.
    if (refusal) {
      if (isAbort) {
        effects.showError(refusal);
      }
      const thread = adoptThread(shown, savedThread);
      showSaved(thread, turn.request);
      handBack(turn, thread, false);
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
    messages: initialMessages,
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
    if (pending.phase === "running" || held) {
      return;
    }
    if (pending.phase !== "idle") {
      setHeld(true);
      const result = await (pending.phase === "settling"
        ? pending.result
        : settle(pending.ended));
      setHeld(false);
      // The chat closed while the send waited. Its text stays in the
      // composer's saved draft.
      if (!effects.isMounted()) {
        return;
      }
      if (phase.phase === "unsettled") {
        effects.sendBlocked(phase.reason);
      }
      if (result !== "settled" || phase.phase !== "idle") {
        return;
      }
    }
    const request = prepare();
    if (!request) {
      return;
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
    commit({ phase: "running", turn, refusal: undefined, stopping: false });
    send(turn).catch(() => {
      if (isRunning(turn)) {
        commit(IDLE);
      }
    });
  };

  return {
    chat,
    getStatus: () => status,
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
