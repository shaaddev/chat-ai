export interface ChatInputState {
  autoDocumentGeneration: boolean;
  input: string;
  useSearch: boolean;
}

export function createChatDrafts({
  defaults,
  useSearchChanged,
}: {
  defaults: () => ChatInputState;
  useSearchChanged: (useSearch: boolean) => void;
}) {
  const drafts = new Map<string, ChatInputState>();
  const get = (key: string): ChatInputState => drafts.get(key) ?? defaults();

  return {
    get,
    set(key: string, change: Partial<ChatInputState>) {
      const current = get(key);
      drafts.set(key, { ...current, ...change });
      if (
        typeof change.useSearch === "boolean" &&
        change.useSearch !== current.useSearch
      ) {
        useSearchChanged(change.useSearch);
      }
    },
    clear(key: string) {
      drafts.set(key, defaults());
    },
    forget(key: string) {
      drafts.delete(key);
    },
  };
}
