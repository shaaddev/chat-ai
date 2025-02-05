"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquareText, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Chat {
  id: string;
  title: string;
  updatedAt: Date;
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
        setChats(data);
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
      const res = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("failed to delete chat");
      }

      setChats(chats.filter((chat) => chat.id !== chatId));
      if (pathname === `/chat/${chatId}`) {
        router.push("/");
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-8rem)]">
      {loading ? (
        <div className="space-y-2 px-2">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-2 px-2">
          {chats.map((chat) => (
            <div key={chat.id} className="group relative rounded-xl">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start font-normal transition-all duration-200 ease-in-out",
                  pathname === `/chat/${chat.id}` && "bg-accent",
                  "group-hover:pr-12"
                )}
                asChild
              >
                <Link href={`/chat/${chat.id}`} className="flex justify-start">
                  <div className="flex flex-row items-center">
                    <MessageSquareText className="mr-2 size-4 " />
                    <span className="truncate">{chat.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full opacity-0 transition-opacity duration-200 ease-in-out hover:opacity-100 bg-none"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(chat.id);
                    }}
                  >
                    <Trash className="size-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
