import type { ChatMessage } from "@/lib/types";

// Back and Forward remount a chat with the payload the router cached when
// it first showed the chat, so a payload already shown marks a restore.
export function createSavedThreads() {
  const shownPayloads = new WeakSet<ChatMessage[]>();
  const latest = new Map<string, ChatMessage[]>();

  return {
    open(chatId: string, payload: ChatMessage[]) {
      const restored = shownPayloads.has(payload);
      const thread = (restored && latest.get(chatId)) || payload;
      return { restored, thread };
    },
    shown(chatId: string, payload: ChatMessage[]) {
      if (payload.length > 0 && !shownPayloads.has(payload)) {
        shownPayloads.add(payload);
        latest.set(chatId, payload);
      }
    },
    save(chatId: string, thread: ChatMessage[]) {
      latest.set(chatId, thread);
    },
  };
}

export type SavedThreads = ReturnType<typeof createSavedThreads>;
