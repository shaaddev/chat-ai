import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers } from "@/lib/utils";

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

export type TurnOutcome = "finished" | "refused" | "unknown";

export function turnOutcome({
  isAbort,
  isError,
  error,
}: {
  isAbort: boolean;
  isError: boolean;
  error: unknown;
}): TurnOutcome {
  if (isAbort) {
    return "unknown";
  }
  if (!isError) {
    return "finished";
  }
  return turnFailure(error) === "refused" ? "refused" : "unknown";
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
): Promise<SettledThread> {
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
      return { messages: [], turnSaved: false };
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
