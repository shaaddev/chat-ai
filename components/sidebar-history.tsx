"use client";

import { Loader2, MessageSquareText, Trash } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { memo } from "react";
import { useChat } from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth";

interface SidebarHistoryProps {
  session: Session | null;
}

function SidebarHistoryComponent({ session }: SidebarHistoryProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { chats, loading, loadingChats, deleteChat } = useChat();

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
        <div className="flex justify-center items-center py-8">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <div className="space-y-2 px-2">
        {session &&
          chats.map((chat) => (
            <SidebarMenuItem
              key={chat.id}
              className="group relative rounded-xl hover:bg-neutral-800"
            >
              <SidebarMenuButton
                asChild
                isActive={pathname === `/chat/${chat.id}`}
                className="group relative w-full justify-start pr-8 px-2 py-6"
                onClick={() => router.push(`/chat/${chat.id}`)}
              >
                <div>
                  <MessageSquareText className="mr-2 size-4 shrink-0" />
                  <span className="truncate">{chat.title}</span>
                  {loadingChats.has(chat.id) && (
                    <Loader2 className="absolute right-8 top-1/2 transform -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute cursor-pointer right-0 top-0 h-full opacity-0 transition-opacity duration-200 hover:opacity-100 rounded-xl bg-none"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(chat.id);
                    }}
                  >
                    <Trash className="size-4 text-red-600" />
                  </Button>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        {!session && (
          <div className="text-sm text-neutral-400 px-2 py-1">No chats yet</div>
        )}
      </div>
    </SidebarMenu>
  );
}

export const SidebarHistory = memo(SidebarHistoryComponent);
