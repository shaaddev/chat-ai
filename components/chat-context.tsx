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
import type { Attachment } from "@/lib/types";

interface Chat {
  createdAt: Date;
  id: string;
  title: string;
  updatedAt: Date;
}

interface ChatInputState {
  attachments: Attachment[];
  autoDocumentGeneration: boolean;
  input: string;
  useSearch: boolean;
}

interface ChatContextType {
  addOptimisticChat: (chat: Chat) => void;
  chats: Chat[];
  deleteChat: (chatId: string) => Promise<void>;
  loading: boolean;
  loadingChats: Set<string>;
  refreshChats: () => Promise<void>;
  refreshSpecificChat: (chatId: string) => Promise<void>;
  setChatLoading: (chatId: string, loading: boolean) => void;
  updateChatTitle: (chatId: string, title: string) => void;
}

interface ChatDraftContextType {
  clearChatInputState: (chatId: string) => void;
  getChatInputState: (chatId: string) => ChatInputState;
  setChatInputState: (chatId: string, state: Partial<ChatInputState>) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);
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

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChats, setLoadingChats] = useState<Set<string>>(new Set());
  const chatInputStatesRef = useRef<Map<string, ChatInputState>>(new Map());

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/chats", {
        cache: "no-store",
      });

      if (res.status === 401) {
        setChats([]);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch chats");
      }

      const data = await res.json();

      const sortedChats = data.sort(
        (a: Chat, b: Chat) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setChats(sortedChats);
    } catch (error) {
      console.error("Error fetching chats: ", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // initial fetch
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const refreshChats = useCallback(async () => {
    await fetchChats();
  }, [fetchChats]);

  const addOptimisticChat = useCallback((chat: Chat) => {
    setChats((prevChats) => {
      // Check if chat already exists
      const exists = prevChats.find((c) => c.id === chat.id);
      if (exists) {
        return prevChats;
      }

      // Add new chat at the beginning (most recent)
      return [chat, ...prevChats];
    });
  }, []);

  const setChatLoading = useCallback((chatId: string, loading: boolean) => {
    setLoadingChats((prev) => {
      const newSet = new Set(prev);
      if (loading) {
        newSet.add(chatId);
      } else {
        newSet.delete(chatId);
      }
      return newSet;
    });
  }, []);

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId ? { ...chat, title, updatedAt: new Date() } : chat
      )
    );
  }, []);

  const refreshSpecificChat = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const updatedChat = await res.json();
        setChats((prevChats) =>
          prevChats.map((chat) => (chat.id === chatId ? updatedChat : chat))
        );
      }
    } catch (error) {
      console.error("Error fetching specific chat: ", error);
    }
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      const res = fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      toast.promise(res, {
        loading: "Deleting chat...",
        success: "Chat deleted successfully",
        error: "Failed to delete chat",
      });

      setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
      chatInputStatesRef.current.delete(chatId);
    } catch (error) {
      console.error("Error deleting chat: ", error);
    }
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

  const contextValue = useMemo(
    () => ({
      chats,
      loading,
      loadingChats,
      refreshChats,
      deleteChat,
      addOptimisticChat,
      setChatLoading,
      updateChatTitle,
      refreshSpecificChat,
    }),
    [
      chats,
      loading,
      loadingChats,
      refreshChats,
      deleteChat,
      addOptimisticChat,
      setChatLoading,
      updateChatTitle,
      refreshSpecificChat,
    ]
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
    <ChatContext.Provider value={contextValue}>
      <ChatDraftContext.Provider value={draftContextValue}>
        {children}
      </ChatDraftContext.Provider>
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

export function useChatDraft() {
  const context = useContext(ChatDraftContext);
  if (context === undefined) {
    throw new Error("useChatDraft must be used within a ChatProvider");
  }
  return context;
}
