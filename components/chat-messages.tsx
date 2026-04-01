import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { FileText, LoaderIcon, ImageIcon } from "lucide-react";
import { Fragment, memo, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
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
import { EmptyChatState } from "./empty-chat-state";
import { Markdown } from "./markdown";
import { ThinkingIndicator } from "./thinking-indicator";

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  selectedChatModel: string;
  isDocumentSheetOpen?: boolean;
  documentDraftMarkdown?: string;
  documentDraftTitle?: string;
  documentDraftFormat?: ExportFormat;
  documentSourceMessageId?: string | null;
  onOpenDocumentBuilder?: () => void;
  onSuggestionClick?: (text: string) => void;
}

function DocumentCard({
  isDocumentSheetOpen,
  documentDraftMarkdown,
  documentDraftTitle,
  documentDraftFormat,
  onOpenDocumentBuilder,
}: {
  isDocumentSheetOpen: boolean;
  documentDraftMarkdown: string;
  documentDraftTitle?: string;
  documentDraftFormat: ExportFormat;
  onOpenDocumentBuilder?: () => void;
}) {
  const hasCodeBlock = /```[\s\S]*?```/.test(documentDraftMarkdown);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mx-auto mt-2 mb-2 ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
    >
      <Card className="border-border bg-card/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <FileText className="size-4" />
            Document Draft Ready
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {documentDraftTitle || "chat-document"} (
            {documentDraftFormat.toUpperCase()})
            {hasCodeBlock && (
              <span className="ml-2 text-muted-foreground/70">
                &middot; Contains code
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-40 overflow-auto rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
            <Markdown>{documentDraftMarkdown}</Markdown>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onOpenDocumentBuilder}
            >
              Open in Document Builder
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PureMessages({
  chatId,
  messages,
  status,
  selectedChatModel,
  isDocumentSheetOpen = false,
  documentDraftMarkdown,
  documentDraftTitle,
  documentDraftFormat = "docx",
  documentSourceMessageId,
  onOpenDocumentBuilder,
  onSuggestionClick,
}: MessagesProps) {
  const { messagesEndRef, scrollToBottom } = useMessages({ chatId, status });

  useEffect(() => {
    if (status === "streaming" || status === "ready") {
      scrollToBottom();
    }
  }, [messages, status, scrollToBottom]);

  const hasAssistantVisibleText = (() => {
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

  const isImageModelSelected = image_models.some(
    (im) => im.id === selectedChatModel,
  );

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

  if (messages.length === 0 && !showThinking && !isGeneratingImage) {
    return (
      <div className="flex-1 overflow-auto">
        <EmptyChatState onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4 w-full overflow-auto">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <Fragment key={message.id}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <PreviewMessage
                message={message}
                isDocumentSheetOpen={isDocumentSheetOpen}
                isStreaming={
                  status === "streaming" &&
                  message.role === "assistant" &&
                  message.id === messages[messages.length - 1]?.id
                }
              />
            </motion.div>
            {documentDraftMarkdown &&
              documentSourceMessageId === message.id && (
                <DocumentCard
                  isDocumentSheetOpen={isDocumentSheetOpen}
                  documentDraftMarkdown={documentDraftMarkdown}
                  documentDraftTitle={documentDraftTitle}
                  documentDraftFormat={documentDraftFormat}
                  onOpenDocumentBuilder={onOpenDocumentBuilder}
                />
              )}
          </Fragment>
        ))}
      </AnimatePresence>
      {showThinking && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mx-auto ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
        >
          <div className="flex justify-start">
            <ThinkingIndicator />
          </div>
        </motion.div>
      )}
      {isGeneratingImage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mx-auto ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
        >
          <div className="flex justify-start">
            <div className="relative size-80 rounded-xl bg-muted/50 border border-border overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/30 to-muted animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative bg-card rounded-2xl p-4 border border-border">
                    <ImageIcon className="size-8 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LoaderIcon className="size-4 animate-spin" />
                  <span className="text-sm font-medium">
                    Generating image...
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
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
  if (prevProps.documentDraftMarkdown !== nextProps.documentDraftMarkdown)
    return false;
  if (prevProps.documentDraftTitle !== nextProps.documentDraftTitle)
    return false;
  if (prevProps.documentDraftFormat !== nextProps.documentDraftFormat)
    return false;
  if (prevProps.documentSourceMessageId !== nextProps.documentSourceMessageId)
    return false;
  if (prevProps.onOpenDocumentBuilder !== nextProps.onOpenDocumentBuilder)
    return false;
  if (prevProps.onSuggestionClick !== nextProps.onSuggestionClick) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return false;
});
