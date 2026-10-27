import type { AttachmentTray, SentFile } from "@/lib/uploadthing/tray";

export interface ChatInputState {
  autoDocumentGeneration: boolean;
  input: string;
  useSearch: boolean;
}

export interface HandBack {
  files: SentFile[];
  maybeSaved: boolean;
  text: string;
}

export type TakeHandBack = (draftKey: string, text: string) => boolean;

interface Trays {
  get: (key: string) => AttachmentTray;
  move: (from: string, to: string) => void;
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

export type ChatDrafts = ReturnType<typeof createChatDrafts>;

export function createChatDrafts({
  defaults,
  trays,
  useSearchChanged,
}: {
  defaults: () => ChatInputState;
  trays: Trays;
  useSearchChanged: (useSearch: boolean) => void;
}) {
  const drafts = new Map<string, ChatInputState>();
  const takers = new Set<TakeHandBack>();
  const get = (key: string): ChatInputState => drafts.get(key) ?? defaults();

  return {
    get,
    tray: trays.get,
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
      trays.move(from, to);
    },
    handBack(key: string, { files, maybeSaved, text }: HandBack): boolean {
      trays.get(key).restore(files, { maybeSaved });
      const draft = get(key);
      drafts.set(key, { ...draft, input: joinDraftText(text, draft.input) });
      let taken = false;
      for (const take of takers) {
        taken = take(key, text) || taken;
      }
      return taken;
    },
    takeHandBacks(take: TakeHandBack): () => void {
      takers.add(take);
      return () => {
        takers.delete(take);
      };
    },
  };
}
