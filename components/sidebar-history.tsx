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
import { Session } from "@/lib/auth";
import { memo } from "react";

interface SidebarHistoryProps {
  session: Session | null;
}

function SidebarHistoryComponent({ session }: SidebarHistoryProps) {
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
        <div className="space-y-2 px-2 rounded-xl">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
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
                    <Trash className="size-4 text-muted-foreground hover:text-red-600" />
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
