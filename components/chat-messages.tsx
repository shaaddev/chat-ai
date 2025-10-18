import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { memo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@/hooks/use-message";
import type { ChatMessage } from "@/lib/types";
import { PreviewMessage } from "./chat-message";

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

  const hasAssistantVisibleText = (() => {
    // Find the last assistant message and check if it has any non-empty text parts
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") {
        return (m.parts || []).some((p: unknown) => {
          const part = p as { type?: string; text?: string };
          return (
            part?.type === "text" &&
            typeof part.text === "string" &&
            part.text.trim().length > 0
          );
        });
      }
    }
    return false;
  })();

  const showThinking =
    (status === "submitted" || status === "streaming") &&
    !hasAssistantVisibleText;

  return (
    <ScrollArea className="flex-1 p-4 w-full overflow-auto">
      {messages.map((message) => (
        <PreviewMessage key={message.id} message={message} />
      ))}
      {showThinking && (
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-start">
            <div className="text-neutral-400 text-sm px-3 py-2 rounded-2xl bg-neutral-800/50 animate-pulse">
              Thinking...
            </div>
          </div>
        </div>
      )}
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
