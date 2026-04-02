import type { UseChatHelpers } from "@ai-sdk/react";
import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

export function useMessages({
  chatId,
  status,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  useEffect(() => {
    scrollToBottom("instant");
  }, [scrollToBottom]);

  useEffect(() => {
    if (status === "ready") {
      scrollToBottom("smooth");
    }
  }, [status, scrollToBottom]);

  return {
    scrollToBottom,
    messagesEndRef,
    chatId,
    status,
  };
}
