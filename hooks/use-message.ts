import { useEffect, useRef } from "react";
import { UseChatHelpers } from "@ai-sdk/react";
import { ChatMessage } from "@/lib/types";

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

  return {
    scrollToBottom,
    messagesEndRef,
    chatId,
    status,
  };
}
