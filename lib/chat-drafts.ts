export interface ChatInputState {
  autoDocumentGeneration: boolean;
  input: string;
  useSearch: boolean;
}

// A composer on screen takes text handed back to the draft it shows, and
// says whether it did.
export type HandBackWatcher = (draftKey: string, text: string) => boolean;

export function joinDraftText(restored: string, typed: string): string {
  if (!typed.trim()) {
    return restored;
  }
  if (!restored.trim()) {
    return typed;
  }
  return `${restored}\n\n${typed}`;
}

export type ChatDrafts = ReturnType<typeof createChatDrafts>;

export function createChatDrafts({
  defaults,
  useSearchChanged,
}: {
  defaults: () => ChatInputState;
  useSearchChanged: (useSearch: boolean) => void;
}) {
  const drafts = new Map<string, ChatInputState>();
  const watchers = new Set<HandBackWatcher>();
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
    move(from: string, to: string) {
      drafts.set(to, get(from));
      drafts.delete(from);
    },
    // The draft keeps the text even when a composer takes it too, so text
    // that arrives just before the composer closes isn't lost.
    handBack(key: string, text: string): boolean {
      const draft = get(key);
      drafts.set(key, { ...draft, input: joinDraftText(text, draft.input) });
      let shown = false;
      for (const watcher of watchers) {
        shown = watcher(key, text) || shown;
      }
      return shown;
    },
    watchHandBacks(watcher: HandBackWatcher): () => void {
      watchers.add(watcher);
      return () => {
        watchers.delete(watcher);
      };
    },
  };
}
