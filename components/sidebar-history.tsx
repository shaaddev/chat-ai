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
        <div
          key={i}
          className="flex items-center gap-2 px-2 py-3 rounded-lg"
        >
          <div className="size-4 rounded bg-muted animate-pulse shrink-0" />
          <div className={cn("h-3 rounded bg-muted animate-pulse", w)} />
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
      router.refresh();
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
                key={chat.id}
                className={cn(
                  "group relative rounded-lg transition-colors",
                  isActive
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50",
                )}
              >
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="relative w-full justify-start pr-8 px-2 py-5 cursor-pointer"
                  onClick={() => router.push(`/chat/${chat.id}`)}
                >
                  <div>
                    <MessageSquareText className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[13px]">{chat.title}</span>
                    {loadingChats.has(chat.id) && (
                      <div className="absolute right-8 top-1/2 -translate-y-1/2">
                        <div className="size-3.5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute cursor-pointer right-0 top-0 h-full opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(chat.id);
                      }}
                    >
                      <Trash className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        {!session && (
          <div className="text-sm text-muted-foreground px-2 py-1">
            No chats yet
          </div>
        )}
      </div>
    </SidebarMenu>
  );
}

export const SidebarHistory = memo(SidebarHistoryComponent);
