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
import {
  type ChatDrafts,
  type ChatInputState,
  createChatDrafts,
} from "@/lib/chat-drafts";
import { getAttachmentTray, moveAttachmentTray } from "./attachment-tray";

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

type PendingEditKind = PendingEdit["kind"];

// Each chat can have one unconfirmed edit of each kind, so a pin and a rename
// in flight together both show, and each settles on its own.
type PendingEdits = ReadonlyMap<
  string,
  ReadonlyMap<PendingEditKind, PendingEdit>
>;

interface ChatActions {
  addOptimisticChat: (chat: NewChat) => void;
  clearChats: () => void;
  deleteChat: (chatId: string) => void;
  flushPendingDeletes: () => Promise<void>;
  refreshChats: () => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  setChatLoading: (chatId: string, loading: boolean) => void;
  setPinnedKey: (
    chat: Pick<ChatSummary, "id" | "pinnedKey">,
    pinnedKey: string | null
  ) => Promise<void>;
}

interface PendingDelete {
  commit: () => Promise<void>;
  sendOnUnload: () => void;
}

interface ChatListState {
  loadingChats: ReadonlySet<string>;
  pendingEdits: PendingEdits;
}

const ChatActionsContext = createContext<ChatActions | undefined>(undefined);
const ChatListStateContext = createContext<ChatListState | undefined>(
  undefined
);
const ChatDraftContext = createContext<ChatDrafts | undefined>(undefined);

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
  const forChat = new Map(edits.get(chatId)).set(edit.kind, edit);
  return new Map(edits).set(chatId, forChat);
}

function withoutEdit(edits: PendingEdits, chatId: string, edit: PendingEdit) {
  const forChat = edits.get(chatId);
  if (forChat?.get(edit.kind) !== edit) {
    return edits;
  }
  const remaining = new Map(forChat);
  remaining.delete(edit.kind);
  const next = new Map(edits);
  if (remaining.size === 0) {
    next.delete(chatId);
  } else {
    next.set(chatId, remaining);
  }
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
    const forChat = edits.get(chat.id);
    if (!forChat) {
      return [chat];
    }
    if (forChat.has("delete")) {
      return [];
    }
    const pin = forChat.get("pin");
    const rename = forChat.get("rename");
    return [
      {
        ...chat,
        ...(pin?.kind === "pin" ? { pinnedKey: pin.pinnedKey } : {}),
        ...(rename?.kind === "rename" ? { title: rename.title } : {}),
      },
    ];
  });
}

function pinFailure(from: string | null, to: string | null) {
  if (to === null) {
    return "Chat wasn't unpinned";
  }
  return from === null ? "Chat wasn't pinned" : "Chat wasn't moved";
}

type EditFailure =
  | "offline"
  | "signed-out"
  | "rejected"
  | "not-saved-yet"
  | "deleted"
  | "server";

const EDIT_FAILURE_REASONS: Record<EditFailure, string> = {
  offline: "Check your connection and try again.",
  "signed-out": "You're signed out. Sign in and try again.",
  rejected: "The server didn't accept the change.",
  "not-saved-yet": "It isn't saved yet. Try again in a moment.",
  deleted: "You deleted it in another tab or on another device.",
  server: "The server couldn't save the change. Try again in a moment.",
};

// A chat loads from submit until its reply streams, and the server saves a
// new chat before it streams. A 404 for an edit sent while the chat was
// loading means the chat wasn't saved yet.
function editFailure(
  res: Response | null,
  sentWhileLoading: boolean
): EditFailure {
  if (!res) {
    return "offline";
  }
  switch (res.status) {
    case 400:
      return "rejected";
    case 401:
      return "signed-out";
    case 404:
      return sentWhileLoading ? "not-saved-yet" : "deleted";
    default:
      return "server";
  }
}

// Repeats until nothing is left, so a delete started while logout waits
// still goes out before the session ends.
async function settleDeletes(
  pending: ReadonlyMap<string, PendingDelete>,
  inFlight: ReadonlySet<Promise<void>>
): Promise<void> {
  if (pending.size === 0 && inFlight.size === 0) {
    return;
  }
  await Promise.all([
    ...[...pending.values()].map((pendingDelete) => pendingDelete.commit()),
    ...inFlight,
  ]);
  await settleDeletes(pending, inFlight);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { cache, mutate } = useSWRConfig();
  const [pendingEdits, setPendingEdits] = useState<PendingEdits>(
    () => new Map()
  );
  const [loadingChats, setLoadingChats] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [drafts] = useState(() =>
    createChatDrafts({
      defaults: () => ({
        ...DEFAULT_CHAT_INPUT_STATE,
        useSearch: getDefaultUseSearch(),
      }),
      trays: { get: getAttachmentTray, move: moveAttachmentTray },
      useSearchChanged: persistUseSearch,
    })
  );
  const pendingDeletesRef = useRef<Map<string, PendingDelete>>(new Map());
  const inFlightDeletesRef = useRef<Set<Promise<void>>>(new Set());
  const lastPinRequestRef = useRef<Map<string, Promise<Response | null>>>(
    new Map()
  );
  const loadingChatsRef = useRef(loadingChats);

  useEffect(() => {
    loadingChatsRef.current = loadingChats;
  }, [loadingChats]);

  // A delete waits behind its Undo toast. If the page unloads first, send it
  // with keepalive so the chat the user saw disappear stays deleted.
  useEffect(() => {
    const sendPendingDeletes = () => {
      for (const pending of pendingDeletesRef.current.values()) {
        pending.sendOnUnload();
      }
    };
    window.addEventListener("pagehide", sendPendingDeletes);
    return () => window.removeEventListener("pagehide", sendPendingDeletes);
  }, []);

  const flushPendingDeletes = useCallback(
    () => settleDeletes(pendingDeletesRef.current, inFlightDeletesRef.current),
    []
  );

  const updateCachedChats = useCallback(
    (update: (chats: ChatSummary[]) => ChatSummary[]) =>
      mutate<ChatSummary[]>(CHATS_KEY, (chats) => chats && update(chats), {
        revalidate: false,
      }),
    [mutate]
  );

  const forgetChat = useCallback(
    (chatId: string) => {
      drafts.forget(chatId);
      return updateCachedChats((chats) =>
        chats.filter((chat) => chat.id !== chatId)
      );
    },
    [updateCachedChats]
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

      const sentWhileLoading = loadingChatsRef.current.has(chatId);
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
        const failure = editFailure(res, sentWhileLoading);
        if (failure === "deleted") {
          await forgetChat(chatId);
        }
        toast.error("Chat wasn't renamed", {
          description:
            failure === "rejected"
              ? "The server didn't accept that title. Try a different one."
              : EDIT_FAILURE_REASONS[failure],
        });
      }
      setPendingEdits((edits) => withoutEdit(edits, chatId, edit));
    },
    [forgetChat, updateCachedChats]
  );

  const deleteChat = useCallback(
    (chatId: string) => {
      const edit: PendingEdit = { kind: "delete" };
      setPendingEdits((edits) => withEdit(edits, chatId, edit));

      let settled = false;
      let toastId: string | number | undefined;
      const settle = () => {
        if (settled) {
          return false;
        }
        settled = true;
        pendingDeletesRef.current.delete(chatId);
        return true;
      };
      const undo = () => {
        if (settle()) {
          setPendingEdits((edits) => withoutEdit(edits, chatId, edit));
        }
      };
      const send = async () => {
        const res = await sendChatRequest(chatId, { method: "DELETE" });
        if (res && (res.ok || res.status === 404)) {
          await forgetChat(chatId);
        } else {
          toast.error("Chat wasn't deleted", {
            description: "It's back in your list. Try deleting it again.",
          });
        }
        setPendingEdits((edits) => withoutEdit(edits, chatId, edit));
      };
      // Logout awaits in-flight deletes too, so one already sent when the
      // toast closed still lands before the session ends.
      const commit = async () => {
        if (!settle()) {
          return;
        }
        toast.dismiss(toastId);
        const request = send();
        inFlightDeletesRef.current.add(request);
        try {
          await request;
        } finally {
          inFlightDeletesRef.current.delete(request);
        }
      };
      // After a back/forward-cache restore the page comes back as it was, so
      // the toast must already be gone or its Undo would show a deleted chat.
      const sendOnUnload = () => {
        if (!settle()) {
          return;
        }
        fetch(`/api/chats/${chatId}`, { method: "DELETE", keepalive: true });
        toast.dismiss(toastId);
        forgetChat(chatId);
        setPendingEdits((edits) => withoutEdit(edits, chatId, edit));
      };

      pendingDeletesRef.current.set(chatId, { commit, sendOnUnload });
      toastId = toast("Chat deleted", {
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: undo },
        onAutoClose: commit,
        onDismiss: commit,
      });
    },
    [forgetChat]
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

      const sentWhileLoading = loadingChatsRef.current.has(chat.id);
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
        const failure = editFailure(res, sentWhileLoading);
        if (failure === "deleted") {
          await forgetChat(chat.id);
        }
        const reason = EDIT_FAILURE_REASONS[failure];
        toast.error(pinFailure(chat.pinnedKey, pinnedKey), {
          description:
            failure === "deleted"
              ? reason
              : `It's back where it was. ${reason}`,
        });
      }
      setPendingEdits((edits) => withoutEdit(edits, chat.id, edit));
    },
    [forgetChat, updateCachedChats]
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

  const actions = useMemo<ChatActions>(
    () => ({
      addOptimisticChat,
      clearChats,
      deleteChat,
      flushPendingDeletes,
      refreshChats,
      renameChat,
      setChatLoading,
      setPinnedKey,
    }),
    [
      addOptimisticChat,
      clearChats,
      deleteChat,
      flushPendingDeletes,
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

  return (
    <ChatActionsContext.Provider value={actions}>
      <ChatListStateContext.Provider value={listState}>
        <ChatDraftContext.Provider value={drafts}>
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
  const forChat = context.pendingEdits.get(chatId);
  if (forChat?.has("delete")) {
    return;
  }
  const rename = forChat?.get("rename");
  if (rename?.kind === "rename") {
    return rename.title;
  }
  return data?.find((chat) => chat.id === chatId)?.title;
}

// Reads the sidebar's cached list without a fetcher, so it never sends a
// request of its own.
export function useCachedChats(): ChatSummary[] {
  const context = useContext(ChatListStateContext);
  if (context === undefined) {
    throw new Error("useCachedChats must be used within a ChatProvider");
  }
  const { data } = useSWR<ChatSummary[]>(CHATS_KEY);
  const { pendingEdits } = context;
  return useMemo(
    () => (data ? applyPendingEdits(data, pendingEdits) : []),
    [data, pendingEdits]
  );
}

export function useChatDrafts() {
  const context = useContext(ChatDraftContext);
  if (context === undefined) {
    throw new Error("useChatDrafts must be used within a ChatProvider");
  }
  return context;
}
