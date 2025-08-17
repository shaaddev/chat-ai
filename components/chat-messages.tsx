import { ChatMessage } from "@/lib/types";
import { UseChatHelpers } from "@ai-sdk/react";
import { useMessages } from "@/hooks/use-message";
import { PreviewMessage } from "./chat-message";
import { memo } from "react";
import equal from "fast-deep-equal";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers["status"];
  messages: ChatMessage[];
  setMessages: UseChatHelpers["setMessages"];
}

function PureMessages({ chatId, messages, status }: MessagesProps) {
  const { messagesEndRef } = useMessages({ chatId, status });

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
