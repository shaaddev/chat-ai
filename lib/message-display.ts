import type { ChatMessage } from "@/lib/types";
import { hasVisibleContent } from "@/lib/utils";

// OpenRouter returns this placeholder for reasoning the provider encrypts,
// such as Gemini's.
const REDACTED_REASONING = "[REDACTED]";

export type EmptyReplyReason = "length" | "other";

export function getReasoningText(message: ChatMessage) {
  return message.parts
    .flatMap((part) =>
      part.type === "reasoning" && part.text.trim() !== REDACTED_REASONING
        ? [part.text]
        : []
    )
    .join("\n\n")
    .trim();
}

export function getEmptyReplyReason(
  message: ChatMessage
): EmptyReplyReason | null {
  const finishReason = message.metadata?.finishReason;
  if (
    message.role !== "assistant" ||
    finishReason === undefined ||
    hasVisibleContent(message)
  ) {
    return null;
  }
  return finishReason === "length" ? "length" : "other";
}

export function isShownInThread(message: ChatMessage) {
  return (
    hasVisibleContent(message) ||
    getEmptyReplyReason(message) !== null ||
    (message.role === "assistant" && getReasoningText(message).length > 0)
  );
}

export function endsWithoutReply(messages: ChatMessage[]) {
  return messages.findLast(isShownInThread)?.role === "user";
}
