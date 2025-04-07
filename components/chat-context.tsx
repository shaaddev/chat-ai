"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { toast } from "sonner";

interface Chat {
  id: string;
  title: string;
  updatedAt: Date;
  createdAt: Date;
}

interface ChatContextType {
  chats: Chat[];
  loading: boolean;
  refreshChats: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = async () => {
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
  };

  // initial fetch
  useEffect(() => {
    fetchChats();
  }, []);

  const refreshChats = async () => {
    await fetchChats();
  };

  const deleteChat = async (chatId: string) => {
    try {
      const res = fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      toast.promise(res, {
        loading: "Deleting chat...",
        success: "Chat deleted successfully",
        error: "Failed to delete chat",
      });

      setChats(chats.filter((chat) => chat.id !== chatId));
    } catch (error) {
      console.error("Error deleting chat: ", error);
    }
  };

  return (
    <ChatContext.Provider value={{ chats, loading, refreshChats, deleteChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat mush be used within a ChatProvider");
  }
  return context;
}
