import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { memo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@/hooks/use-message";
import { image_models } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { PreviewMessage } from "./chat-message";
import { ImageIcon, LoaderIcon } from "lucide-react";

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  selectedChatModel: string;
}

function PureMessages({
  chatId,
  messages,
  status,
  selectedChatModel,
}: MessagesProps) {
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

  // Check if the selected model is an image model
  const isImageModelSelected = image_models.some(
    (im) => im.id === selectedChatModel,
  );

  // Check if there's already an image attachment in the assistant message
  const hasAssistantImageAttachment = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant") {
        return (m.parts || []).some((p: unknown) => {
          const part = p as { type?: string };
          return part?.type === "file";
        });
      }
    }
    return false;
  })();

  const showThinking =
    (status === "submitted" || status === "streaming") &&
    !hasAssistantVisibleText &&
    !isImageModelSelected;

  const isGeneratingImage =
    (status === "submitted" || status === "streaming") &&
    isImageModelSelected &&
    !hasAssistantImageAttachment;

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
      {isGeneratingImage && (
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-start">
            <div className="relative size-80 rounded-xl bg-neutral-800/50 border border-neutral-700/50 overflow-hidden">
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-700/30 to-neutral-800 animate-pulse" />

              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />

              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative bg-neutral-800 rounded-2xl p-4 border border-neutral-700/50">
                    <ImageIcon className="size-8 text-neutral-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-neutral-400">
                  <LoaderIcon className="size-4 animate-spin" />
                  <span className="text-sm font-medium">
                    Generating image...
                  </span>
                </div>
              </div>
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
  if (prevProps.selectedChatModel !== nextProps.selectedChatModel) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return false;
});
