"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatContextType {
  chats: Chat[];
  loading: boolean;
  loadingChats: Set<string>;
  refreshChats: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  addOptimisticChat: (chat: Chat) => void;
  setChatLoading: (chatId: string, loading: boolean) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  refreshSpecificChat: (chatId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChats, setLoadingChats] = useState<Set<string>>(new Set());

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
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
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
        chat.id === chatId ? { ...chat, title, updatedAt: new Date() } : chat,
      ),
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
          prevChats.map((chat) => (chat.id === chatId ? updatedChat : chat)),
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
    } catch (error) {
      console.error("Error deleting chat: ", error);
    }
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
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat mush be used within a ChatProvider");
  }
  return context;
}
