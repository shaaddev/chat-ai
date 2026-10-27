"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ComponentProps, useEffect, useState } from "react";
import { createFreshChats } from "@/lib/fresh-chat";
import { Chat } from "./chat";

type FreshChatProps = Omit<
  ComponentProps<typeof Chat>,
  "id" | "initialMessages" | "onIdFreed" | "onIdTaken"
> & { pageChatId: string };

const freshChats = createFreshChats();

export function FreshChat({ pageChatId, ...props }: FreshChatProps) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = props.session?.user.id;
  const [visit, setVisit] = useState(() => ({
    chatId: freshChats.idFor(pageChatId, userId),
    pathname,
  }));
  if (pathname !== visit.pathname) {
    setVisit({
      chatId:
        pathname === "/" ? freshChats.idFor(pageChatId, userId) : visit.chatId,
      pathname,
    });
  }

  const isFresh = pathname === "/";
  useEffect(() => {
    if (isFresh) {
      freshChats.shown(visit.chatId, userId);
    }
  }, [isFresh, userId, visit.chatId]);

  // A first send moves the URL to its chat with replaceState while the router
  // keeps this page. Back or Forward to another chat's URL can restore this
  // page, which never held that chat, so the router has to load it.
  const isOtherChat =
    pathname.startsWith("/chat/") && pathname !== `/chat/${visit.chatId}`;
  useEffect(() => {
    if (isOtherChat) {
      router.replace(pathname);
    }
  }, [isOtherChat, pathname, router]);
  if (isOtherChat) {
    return null;
  }

  return (
    <Chat
      {...props}
      id={visit.chatId}
      initialMessages={[]}
      key={visit.chatId}
      onIdFreed={freshChats.free}
      onIdTaken={freshChats.take}
    />
  );
}
