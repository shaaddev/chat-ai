"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquareText, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

interface Chat {
  id: string;
  title: string;
  updatedAt: Date;
  createdAt: Date;
}

export function SidebarHistory() {
  const pathname = usePathname();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchChats() {
      try {
        const res = await fetch("/api/chats");
        if (!res.ok) {
          throw new Error("Failed to fetch chats");
        }
        const data = await res.json();

        const sortedChats = data.sort(
          (a: Chat, b: Chat) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setChats(sortedChats);
      } catch (error) {
        console.error("Error fetching chats: ", error);
      } finally {
        setLoading(false);
      }
    }

    fetchChats();
  }, []);

  const handleDelete = async (chatId: string) => {
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
      if (pathname === `/chat/${chatId}`) {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 px-2">
        {chats.map((chat, index) => (
          <>
            <Skeleton key={index} className="h-10 w-full" />
          </>
        ))}
      </div>
    );
  }

  return (
    <SidebarMenu>
      <div className="space-y-2 px-2">
        {chats.map((chat) => (
          <SidebarMenuItem
            key={chat.id}
            className="group relative rounded-xl hover:bg-neutral-800 px-2 py-1"
          >
            <SidebarMenuButton
              asChild
              isActive={pathname === `/chat/${chat.id}`}
              className="group relative w-full justify-start pr-8"
            >
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => router.push(`/chat/${chat.id}`)}
              >
                <MessageSquareText className="mr-2 size-4 shrink-0" />
                <span className="truncate">{chat.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full opacity-0 transition-opacity duration-200 hover:opacity-100 rounded-xl bg-none"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(chat.id);
                  }}
                >
                  <Trash className="size-4 text-muted-foreground hover:text-red-600" />
                </Button>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </div>
    </SidebarMenu>
  );
}
