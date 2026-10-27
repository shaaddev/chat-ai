"use client";

import { usePathname } from "next/navigation";
import { type ComponentProps, useEffect, useState } from "react";
import { createFreshChats } from "@/lib/fresh-chat";
import { generateUUID } from "@/lib/utils";
import { Chat } from "./chat";

type FreshChatProps = Omit<
  ComponentProps<typeof Chat>,
  "id" | "initialMessages" | "onIdFreed" | "onIdTaken"
> & { pageChatId: string };

const freshChats = createFreshChats();

// A first send moves the URL to the chat with replaceState while Next's
// router keeps this page. The router can show the page again for `/`, after
// New chat or Back, with the id it was rendered with.
export function FreshChat({ pageChatId, ...props }: FreshChatProps) {
  const pathname = usePathname();
  const [visit, setVisit] = useState(() => ({
    chatId: freshChats.idFor(pageChatId),
    pathname,
  }));
  if (pathname !== visit.pathname) {
    setVisit({
      chatId: pathname === "/" ? generateUUID() : visit.chatId,
      pathname,
    });
  }

  // Back to the URL of a chat this page started restores this page, not the
  // chat. That history entry never held the chat's page, so load it in full.
  const isOtherChat =
    pathname.startsWith("/chat/") && pathname !== `/chat/${visit.chatId}`;
  useEffect(() => {
    if (isOtherChat) {
      window.location.reload();
    }
  }, [isOtherChat]);
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
