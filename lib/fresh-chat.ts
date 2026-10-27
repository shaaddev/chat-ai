import { generateUUID } from "@/lib/utils";

export type NewChatSend = "sent" | "refused" | "lost";

// The composer at `/` belongs to the signed-in user, not to the id under
// it, which changes once a send may have created that chat.
export const freshDraftKey = (userId: string | undefined) =>
  `fresh:${userId ?? ""}`;

type IdState = "sending" | "unknown";

// No entry means nothing was sent, or every send was refused. A refusal
// proves only that its own request saved nothing, so once a send's outcome
// is unknown, the id stays taken.
const AFTER: Record<
  NewChatSend,
  (state: IdState | undefined) => IdState | undefined
> = {
  sent: (state) => state ?? "sending",
  refused: (state) => (state === "sending" ? undefined : state),
  lost: () => "unknown",
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
