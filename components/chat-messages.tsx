import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { FileText, LoaderIcon, ImageIcon } from "lucide-react";
import { memo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@/hooks/use-message";
import { image_models } from "@/lib/ai/models";
import type { ExportFormat } from "@/lib/document-export";
import type { ChatMessage } from "@/lib/types";
import { PreviewMessage } from "./chat-message";

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  selectedChatModel: string;
  isDocumentSheetOpen?: boolean;
  documentDraftHtml?: string;
  documentDraftTitle?: string;
  documentDraftFormat?: ExportFormat;
  onOpenDocumentBuilder?: () => void;
}

function htmlToPreviewText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function PureMessages({
  chatId,
  messages,
  status,
  selectedChatModel,
  isDocumentSheetOpen = false,
  documentDraftHtml,
  documentDraftTitle,
  documentDraftFormat = "docx",
  onOpenDocumentBuilder,
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
        <PreviewMessage
          key={message.id}
          message={message}
          isDocumentSheetOpen={isDocumentSheetOpen}
        />
      ))}
      {documentDraftHtml ? (
        <div
          className={`mx-auto mt-2 ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
        >
          <Card className="border-neutral-700 bg-neutral-900/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-neutral-100 flex items-center gap-2">
                <FileText className="size-4" />
                Document Draft Ready
              </CardTitle>
              <CardDescription className="text-neutral-400">
                {documentDraftTitle || "chat-document"} (
                {documentDraftFormat.toUpperCase()})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="max-h-28 overflow-auto rounded-md border border-neutral-800 bg-neutral-900 p-3 text-xs whitespace-pre-wrap text-neutral-300">
                {htmlToPreviewText(documentDraftHtml)}
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                  onClick={onOpenDocumentBuilder}
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {showThinking && (
        <div
          className={`mx-auto ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
        >
          <div className="flex justify-start">
            <div className="text-neutral-400 text-sm px-3 py-2 rounded-2xl bg-neutral-800/50 animate-pulse">
              Thinking...
            </div>
          </div>
        </div>
      )}
      {isGeneratingImage && (
        <div
          className={`mx-auto ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
        >
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
  if (prevProps.isDocumentSheetOpen !== nextProps.isDocumentSheetOpen)
    return false;
  if (prevProps.documentDraftHtml !== nextProps.documentDraftHtml) return false;
  if (prevProps.documentDraftTitle !== nextProps.documentDraftTitle) return false;
  if (prevProps.documentDraftFormat !== nextProps.documentDraftFormat)
    return false;
  if (prevProps.onOpenDocumentBuilder !== nextProps.onOpenDocumentBuilder)
    return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return false;
});
