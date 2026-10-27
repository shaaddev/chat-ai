import type { NewChatSend } from "@/lib/chat-turn";
import { generateUUID } from "@/lib/utils";

export const freshDraftKey = (userId: string | undefined) =>
  `fresh:${userId ?? ""}`;

type TakenBy = "sending" | "maybe-created";

const AFTER: Record<
  NewChatSend,
  (takenBy: TakenBy | undefined) => TakenBy | undefined
> = {
  sent: (takenBy) => takenBy ?? "sending",
  // A refusal proves only that its own request saved nothing.
  refused: (takenBy) => (takenBy === "sending" ? undefined : takenBy),
  lost: () => "maybe-created",
};

export function createFreshChats(newId: () => string = generateUUID) {
  const taken = new Map<string, TakenBy>();
  let current: { chatId: string; userId: string | undefined } | undefined;

  return {
    // Next's router can show `/` again with any id it was rendered with.
    idFor(pageChatId: string, userId: string | undefined): string {
      if (
        current !== undefined &&
        current.userId === userId &&
        !taken.has(current.chatId)
      ) {
        return current.chatId;
      }
      return taken.has(pageChatId) ? newId() : pageChatId;
    },
    shown(chatId: string, userId: string | undefined) {
      current = { chatId, userId };
    },
    record(chatId: string, send: NewChatSend) {
      const next = AFTER[send](taken.get(chatId));
      if (next === undefined) {
        taken.delete(chatId);
      } else {
        taken.set(chatId, next);
      }
    },
  };
}
