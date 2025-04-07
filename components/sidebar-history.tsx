"use client";

import { usePathname, useRouter } from "next/navigation";
import { MessageSquareText, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useChat } from "@/components/chat-context";

export function SidebarHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const { chats, loading, deleteChat } = useChat();

  const handleDelete = async (chatId: string) => {
    await deleteChat(chatId);

    if (pathname === `/chat/${chatId}`) {
      router.push("/");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <SidebarMenu>
        <div className="space-y-2 px-2">
          {chats.map((chat, index) => (
            <>
              <Skeleton key={index} className="h-10 w-full" />
            </>
          ))}
        </div>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <div className="space-y-2 px-2">
        {chats.length === 0 ? (
          <div className="text-sm text-neutral-400 px-2 py-1">No chats yet</div>
        ) : (
          chats.map((chat) => (
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
          ))
        )}
      </div>
    </SidebarMenu>
  );
}
