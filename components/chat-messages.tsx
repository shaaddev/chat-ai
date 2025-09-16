import { ChatMessage } from "@/lib/types";
import { UseChatHelpers } from "@ai-sdk/react";
import { useMessages } from "@/hooks/use-message";
import { PreviewMessage } from "./chat-message";
import { memo, useEffect } from "react";
import equal from "fast-deep-equal";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}

function PureMessages({ chatId, messages, status }: MessagesProps) {
  const { messagesEndRef, scrollToBottom } = useMessages({ chatId, status });

  useEffect(() => {
    if (status === "streaming" || status === "ready") {
      scrollToBottom();
    }
  }, [messages, status, scrollToBottom]);

  return (
    <ScrollArea className="flex-1 p-4 w-full overflow-auto">
      {messages.map((message) => (
        <PreviewMessage key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </ScrollArea>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return false;
});
