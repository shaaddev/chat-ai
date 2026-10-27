import { generateUUID } from "@/lib/utils";

export type NewChatSend = "sent" | "refused" | "lost";

type IdState = "sending";

// No entry means nothing was sent, or every send was refused.
const AFTER: Record<
  NewChatSend,
  (state: IdState | undefined) => IdState | undefined
> = {
  sent: (state) => state ?? "sending",
  refused: () => undefined,
  lost: (state) => state,
};

export function createFreshChats(newId: () => string = generateUUID) {
  const ids = new Map<string, IdState>();
  let current: { chatId: string; userId: string | undefined } | undefined;

  return {
    // Next's router can show `/` again with any id it was rendered with.
    idFor(pageChatId: string, userId: string | undefined): string {
      if (
        current !== undefined &&
        current.userId === userId &&
        !ids.has(current.chatId)
      ) {
        return current.chatId;
      }
      return ids.has(pageChatId) ? newId() : pageChatId;
    },
    shown(chatId: string, userId: string | undefined) {
      current = { chatId, userId };
    },
    record(chatId: string, send: NewChatSend) {
      const next = AFTER[send](ids.get(chatId));
      if (next === undefined) {
        ids.delete(chatId);
      } else {
        ids.set(chatId, next);
      }
    },
  };
}
