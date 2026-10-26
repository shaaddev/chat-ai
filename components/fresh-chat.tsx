"use client";

import { usePathname } from "next/navigation";
import { type ComponentProps, useEffect, useState } from "react";
import { generateUUID } from "@/lib/utils";
import { Chat } from "./chat";

type FreshChatProps = Omit<
  ComponentProps<typeof Chat>,
  "id" | "initialMessages"
>;

// A first send moves the URL to the chat with replaceState, while the router
// still holds this page. A later visit to `/` then shows this same page
// without asking the server, so each visit to `/` starts its own chat here.
export function FreshChat(props: FreshChatProps) {
  const pathname = usePathname();
  const [visit, setVisit] = useState(() => ({
    chatId: generateUUID(),
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

  return (
    <Chat
      {...props}
      id={visit.chatId}
      initialMessages={[]}
      key={visit.chatId}
    />
  );
}
