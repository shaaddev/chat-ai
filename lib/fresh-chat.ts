import { generateUUID } from "@/lib/utils";

export function createFreshChats(newId: () => string = generateUUID) {
  const taken = new Set<string>();
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
    take(chatId: string) {
      taken.add(chatId);
    },
    free(chatId: string) {
      taken.delete(chatId);
    },
  };
}
