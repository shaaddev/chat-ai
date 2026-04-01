"use client";

import { MessageSquareText, Trash } from "lucide-react";
import { motion } from "motion/react";
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

function SidebarSkeleton() {
  const widths = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-3/5"];
  return (
    <div className="space-y-2 px-2">
      {widths.map((w, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-2 px-2 py-3 rounded-xl"
        >
          <div className="size-4 rounded bg-muted animate-pulse shrink-0" />
          <div className={`h-3 rounded bg-muted animate-pulse ${w}`} />
        </motion.div>
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
      <div className="space-y-1 px-2">
        {session &&
          chats.map((chat, index) => {
            const isActive = pathname === `/chat/${chat.id}`;
            return (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: index * 0.02 }}
              >
                <SidebarMenuItem className="group relative rounded-xl hover:bg-sidebar-accent transition-colors">
                  {isActive && (
                    <motion.div
                      layoutId="active-chat-indicator"
                      className="absolute left-0 top-1/4 h-1/2 w-0.5 rounded-full bg-primary"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="group relative w-full justify-start pr-8 px-2 py-6 cursor-pointer"
                    onClick={() => router.push(`/chat/${chat.id}`)}
                  >
                    <div>
                      <MessageSquareText className="mr-2 size-4 shrink-0" />
                      <span className="truncate">{chat.title}</span>
                      {loadingChats.has(chat.id) && (
                        <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                          <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute cursor-pointer right-0 top-0 h-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 rounded-xl bg-none"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(chat.id);
                        }}
                      >
                        <Trash className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </motion.div>
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
