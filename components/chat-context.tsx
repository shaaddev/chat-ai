"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import type { Attachment } from "@/lib/types";

const CHATS_KEY = "/api/chats";
const UNDO_WINDOW_MS = 5000;

export interface ChatSummary {
  id: string;
  pinnedKey: string | null;
  title: string;
  updatedAt: Date;
}

interface NewChat {
  createdAt?: Date;
  id: string;
  title: string;
  updatedAt?: Date;
}

// SWR's optimisticData rolls back to a whole-list snapshot, which would undo
// any other edit that settled in between. Unconfirmed edits live here instead
// and overlay the cache, so each one settles on its own.
type PendingEdit =
  | { kind: "delete" }
  | { kind: "pin"; pinnedKey: string | null }
  | { kind: "rename"; title: string };

type PendingEdits = ReadonlyMap<string, PendingEdit>;

interface ChatInputState {
  attachments: Attachment[];
  autoDocumentGeneration: boolean;
  input: string;
  useSearch: boolean;
}

interface ChatActions {
  addOptimisticChat: (chat: NewChat) => void;
  clearChats: () => void;
  deleteChat: (chatId: string) => void;
  refreshChats: () => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  setChatLoading: (chatId: string, loading: boolean) => void;
  setPinnedKey: (
    chat: Pick<ChatSummary, "id" | "pinnedKey">,
    pinnedKey: string | null
  ) => Promise<void>;
}

interface ChatListState {
  loadingChats: ReadonlySet<string>;
  pendingEdits: PendingEdits;
}

interface ChatDraftContextType {
  clearChatInputState: (chatId: string) => void;
  getChatInputState: (chatId: string) => ChatInputState;
  setChatInputState: (chatId: string, state: Partial<ChatInputState>) => void;
}

const ChatActionsContext = createContext<ChatActions | undefined>(undefined);
const ChatListStateContext = createContext<ChatListState | undefined>(
  undefined
);
const ChatDraftContext = createContext<ChatDraftContextType | undefined>(
  undefined
);

const USE_SEARCH_STORAGE_KEY = "chat-ai:use-search";

function getDefaultUseSearch(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const stored = localStorage.getItem(USE_SEARCH_STORAGE_KEY);
  if (stored === null) {
    return true;
  }
  return stored === "true";
}

function persistUseSearch(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(USE_SEARCH_STORAGE_KEY, String(value));
}

const DEFAULT_CHAT_INPUT_STATE: ChatInputState = {
  input: "",
  attachments: [],
  useSearch: true,
  autoDocumentGeneration: false,
};

async function fetchChats(url: string): Promise<ChatSummary[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`GET ${url} failed with ${res.status}`);
  }
  const rows: {
    id: string;
    pinnedKey: string | null;
    title: string;
    updatedAt: string;
  }[] = await res.json();
  return rows.map(({ id, pinnedKey, title, updatedAt }) => ({
    id,
    pinnedKey,
    title,
    updatedAt: new Date(updatedAt),
  }));
}

async function sendChatRequest(
  chatId: string,
  init: RequestInit
): Promise<Response | null> {
  try {
    return await fetch(`/api/chats/${chatId}`, init);
  } catch {
    return null;
  }
}

function withEdit(edits: PendingEdits, chatId: string, edit: PendingEdit) {
  return new Map(edits).set(chatId, edit);
}

function withoutEdit(edits: PendingEdits, chatId: string, edit: PendingEdit) {
  if (edits.get(chatId) !== edit) {
    return edits;
  }
  const next = new Map(edits);
  next.delete(chatId);
  return next;
}

function applyPendingEdits(
  chats: ChatSummary[],
  edits: PendingEdits
): ChatSummary[] {
  if (edits.size === 0) {
    return chats;
  }
  return chats.flatMap((chat) => {
    const edit = edits.get(chat.id);
    if (!edit) {
      return [chat];
    }
    if (edit.kind === "delete") {
      return [];
    }
    if (edit.kind === "pin") {
      return [{ ...chat, pinnedKey: edit.pinnedKey }];
    }
    return [{ ...chat, title: edit.title }];
  });
}

function pinFailure(from: string | null, to: string | null) {
  if (to === null) {
    return "Chat wasn't unpinned";
  }
  return from === null ? "Chat wasn't pinned" : "Chat wasn't moved";
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { cache, mutate } = useSWRConfig();
  const [pendingEdits, setPendingEdits] = useState<PendingEdits>(
    () => new Map()
  );
  const [loadingChats, setLoadingChats] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const chatInputStatesRef = useRef<Map<string, ChatInputState>>(new Map());
  const unsentDeletesRef = useRef<Set<string>>(new Set());
  const lastPinRequestRef = useRef<Map<string, Promise<Response | null>>>(
    new Map()
  );

  // A delete waits behind its Undo toast. If the page unloads first, send it
  // with keepalive so the chat the user saw disappear stays deleted.
  useEffect(() => {
    const flushDeletes = () => {
      for (const chatId of unsentDeletesRef.current) {
        fetch(`/api/chats/${chatId}`, { method: "DELETE", keepalive: true });
      }
      unsentDeletesRef.current.clear();
    };
    window.addEventListener("pagehide", flushDeletes);
    return () => window.removeEventListener("pagehide", flushDeletes);
  }, []);

  const updateCachedChats = useCallback(
    (update: (chats: ChatSummary[]) => ChatSummary[]) =>
      mutate<ChatSummary[]>(CHATS_KEY, (chats) => chats && update(chats), {
        revalidate: false,
      }),
    [mutate]
  );

  const refreshChats = useCallback(async () => {
    await mutate(CHATS_KEY);
  }, [mutate]);

  const clearChats = useCallback(() => {
    mutate(CHATS_KEY, undefined, { revalidate: false });
  }, [mutate]);

  const addOptimisticChat = useCallback(
    ({ id, title, updatedAt = new Date() }: NewChat) => {
      if (!cache.get(CHATS_KEY)?.data) {
        return;
      }
      updateCachedChats((chats) =>
        chats.some((chat) => chat.id === id)
          ? chats
          : [{ id, pinnedKey: null, title, updatedAt }, ...chats]
      );
    },
    [cache, updateCachedChats]
  );

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      const edit: PendingEdit = { kind: "rename", title };
      setPendingEdits((edits) => withEdit(edits, chatId, edit));

      const res = await sendChatRequest(chatId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res?.ok) {
        await updateCachedChats((chats) =>
          chats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat))
        );
      } else {
        toast.error("Chat wasn't renamed", {
          description: "Check your connection and try again.",
        });
      }
      setPendingEdits((edits) => withoutEdit(edits, chatId, edit));
    },
    [updateCachedChats]
  );

  const deleteChat = useCallback(
    (chatId: string) => {
      const edit: PendingEdit = { kind: "delete" };
      setPendingEdits((edits) => withEdit(edits, chatId, edit));
      unsentDeletesRef.current.add(chatId);

      let settled = false;
      const undo = () => {
        if (settled) {
          return;
        }
        settled = true;
        unsentDeletesRef.current.delete(chatId);
        setPendingEdits((edits) => withoutEdit(edits, chatId, edit));
      };
      const commit = async () => {
        if (settled) {
          return;
        }
        settled = true;
        unsentDeletesRef.current.delete(chatId);
        const res = await sendChatRequest(chatId, { method: "DELETE" });
        if (res && (res.ok || res.status === 404)) {
          chatInputStatesRef.current.delete(chatId);
          await updateCachedChats((chats) =>
            chats.filter((chat) => chat.id !== chatId)
          );
        } else {
          toast.error("Chat wasn't deleted", {
            description: "It's back in your list. Try deleting it again.",
          });
        }
        setPendingEdits((edits) => withoutEdit(edits, chatId, edit));
      };

      toast("Chat deleted", {
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: undo },
        onAutoClose: commit,
        onDismiss: commit,
      });
    },
    [updateCachedChats]
  );

  const setPinnedKey = useCallback(
    async (
      chat: Pick<ChatSummary, "id" | "pinnedKey">,
      pinnedKey: string | null
    ) => {
      if (chat.pinnedKey === pinnedKey) {
        return;
      }
      const edit: PendingEdit = { kind: "pin", pinnedKey };
      setPendingEdits((edits) => withEdit(edits, chat.id, edit));

      const previous = lastPinRequestRef.current.get(chat.id);
      const request = (previous ?? Promise.resolve(null)).then(() =>
        sendChatRequest(chat.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinnedKey }),
        })
      );
      lastPinRequestRef.current.set(chat.id, request);
      const res = await request;
      if (lastPinRequestRef.current.get(chat.id) === request) {
        lastPinRequestRef.current.delete(chat.id);
      }

      if (res?.ok) {
        await updateCachedChats((chats) =>
          chats.map((cached) =>
            cached.id === chat.id ? { ...cached, pinnedKey } : cached
          )
        );
      } else {
        toast.error(pinFailure(chat.pinnedKey, pinnedKey), {
          description:
            "It's back where it was. Check your connection and try again.",
        });
      }
      setPendingEdits((edits) => withoutEdit(edits, chat.id, edit));
    },
    [updateCachedChats]
  );

  const setChatLoading = useCallback((chatId: string, isLoading: boolean) => {
    setLoadingChats((prev) => {
      if (prev.has(chatId) === isLoading) {
        return prev;
      }
      const next = new Set(prev);
      if (isLoading) {
        next.add(chatId);
      } else {
        next.delete(chatId);
      }
      return next;
    });
  }, []);

  const getChatInputState = useCallback((chatId: string): ChatInputState => {
    const existing = chatInputStatesRef.current.get(chatId);
    if (existing) {
      return existing;
    }
    // Hydrate fresh state with the user's persisted web-search preference.
    return { ...DEFAULT_CHAT_INPUT_STATE, useSearch: getDefaultUseSearch() };
  }, []);

  const setChatInputState = useCallback(
    (chatId: string, state: Partial<ChatInputState>) => {
      const currentState = chatInputStatesRef.current.get(chatId) ?? {
        ...DEFAULT_CHAT_INPUT_STATE,
        useSearch: getDefaultUseSearch(),
      };
      const next = { ...currentState, ...state };
      chatInputStatesRef.current.set(chatId, next);
      // Persist the search preference globally so it survives reloads.
      if (
        typeof state.useSearch === "boolean" &&
        state.useSearch !== currentState.useSearch
      ) {
        persistUseSearch(state.useSearch);
      }
    },
    []
  );

  const clearChatInputState = useCallback((chatId: string) => {
    chatInputStatesRef.current.set(chatId, {
      ...DEFAULT_CHAT_INPUT_STATE,
      useSearch: getDefaultUseSearch(),
    });
  }, []);

  const actions = useMemo<ChatActions>(
    () => ({
      addOptimisticChat,
      clearChats,
      deleteChat,
      refreshChats,
      renameChat,
      setChatLoading,
      setPinnedKey,
    }),
    [
      addOptimisticChat,
      clearChats,
      deleteChat,
      refreshChats,
      renameChat,
      setChatLoading,
      setPinnedKey,
    ]
  );

  const listState = useMemo<ChatListState>(
    () => ({ loadingChats, pendingEdits }),
    [loadingChats, pendingEdits]
  );

  const draftContextValue = useMemo(
    () => ({
      getChatInputState,
      setChatInputState,
      clearChatInputState,
    }),
    [clearChatInputState, getChatInputState, setChatInputState]
  );

  return (
    <ChatActionsContext.Provider value={actions}>
      <ChatListStateContext.Provider value={listState}>
        <ChatDraftContext.Provider value={draftContextValue}>
          {children}
        </ChatDraftContext.Provider>
      </ChatListStateContext.Provider>
    </ChatActionsContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatActionsContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

type ChatList =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      chats: ChatSummary[];
      loadingChats: ReadonlySet<string>;
    };

export function useChatList(): ChatList {
  const context = useContext(ChatListStateContext);
  if (context === undefined) {
    throw new Error("useChatList must be used within a ChatProvider");
  }
  const { data, error } = useSWR(CHATS_KEY, fetchChats);
  const { loadingChats, pendingEdits } = context;
  const chats = useMemo(
    () => data && applyPendingEdits(data, pendingEdits),
    [data, pendingEdits]
  );
  if (chats) {
    return { status: "ready", chats, loadingChats };
  }
  return { status: error ? "error" : "loading" };
}

export function useChatTitle(chatId: string): string | undefined {
  const context = useContext(ChatListStateContext);
  if (context === undefined) {
    throw new Error("useChatTitle must be used within a ChatProvider");
  }
  // On mobile the sidebar, and its list request, stay unmounted while the
  // sheet is closed. This reader fetches only when the list is refreshed.
  const { data } = useSWR(CHATS_KEY, fetchChats, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
  });
  const edit = context.pendingEdits.get(chatId);
  if (edit?.kind === "rename") {
    return edit.title;
  }
  if (edit?.kind === "delete") {
    return;
  }
  return data?.find((chat) => chat.id === chatId)?.title;
}

export function useChatDraft() {
  const context = useContext(ChatDraftContext);
  if (context === undefined) {
    throw new Error("useChatDraft must be used within a ChatProvider");
  }
  return context;
}
