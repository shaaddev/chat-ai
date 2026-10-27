import { generateUUID } from "@/lib/utils";

export function createFreshChats(newId: () => string = generateUUID) {
  const taken = new Set<string>();

  return {
    idFor(pageChatId: string): string {
      return taken.has(pageChatId) ? newId() : pageChatId;
    },
    take(chatId: string) {
      taken.add(chatId);
    },
    free(chatId: string) {
      taken.delete(chatId);
    },
  };
}
