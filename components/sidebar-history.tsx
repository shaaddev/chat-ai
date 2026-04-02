"use client";

import { MessageSquareText, Trash } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface SidebarHistoryProps {
  session: Session | null;
}

function SidebarSkeleton() {
  const widths = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-3/5"];
  return (
    <div className="space-y-1 px-2">
      {widths.map((w, i) => (
        <div className="flex items-center gap-2 rounded-lg px-2 py-3" key={i}>
          <div className="size-4 shrink-0 animate-pulse rounded bg-muted" />
          <div className={cn("h-3 animate-pulse rounded bg-muted", w)} />
        </div>
      ))}
    </div>
  );
}

function SidebarHistoryComponent({ session }: SidebarHistoryProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { chats, loading, loadingChats, deleteChat } = useChat();

  const handleDelete = async (chatId: string) => {
    await deleteChat(chatId);

    if (pathname === `/chat/${chatId}`) {
      router.push("/");
    }
  };

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarSkeleton />
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <div className="space-y-0.5 px-2">
        {session &&
          chats.map((chat) => {
            const isActive = pathname === `/chat/${chat.id}`;
            return (
              <SidebarMenuItem
                className={cn(
                  "group/chat relative rounded-lg transition-colors",
                  isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                )}
                key={chat.id}
              >
                <SidebarMenuButton
                  asChild
                  className="relative w-full cursor-pointer justify-start px-2 py-5 pr-8"
                  isActive={isActive}
                  onClick={() => router.push(`/chat/${chat.id}`)}
                >
                  <div>
                    <MessageSquareText className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[13px]">{chat.title}</span>
                    {loadingChats.has(chat.id) && (
                      <div className="absolute top-1/2 right-8 -translate-y-1/2">
                        <div className="size-3.5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                      </div>
                    )}
                    <Button
                      className="absolute top-0 right-0 h-full cursor-pointer rounded-lg opacity-0 transition-opacity group-hover/chat:opacity-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(chat.id);
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        {!session && (
          <div className="px-2 py-1 text-muted-foreground text-sm">
            No chats yet
          </div>
        )}
      </div>
    </SidebarMenu>
  );
}

export const SidebarHistory = memo(SidebarHistoryComponent);
