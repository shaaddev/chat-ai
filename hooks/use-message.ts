import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

export function useMessages({
  chatId,
  status,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, []);

  useEffect(() => {
    if (status === "streaming" || status === "ready") {
      scrollToBottom();
    }
  }, [status]);

  return {
    scrollToBottom,
    messagesEndRef,
    chatId,
    status,
  };
}
