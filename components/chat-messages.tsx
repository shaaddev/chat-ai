import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { FileText, ImageIcon, LoaderIcon } from "lucide-react";
import { motion } from "motion/react";
import { Fragment, memo, useEffect, useRef } from "react";
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
  documentDraftFormat?: ExportFormat;
  documentDraftMarkdown?: string;
  documentDraftTitle?: string;
  documentSourceMessageId?: string | null;
  isDocumentSheetOpen?: boolean;
  messages: ChatMessage[];
  onOpenDocumentBuilder?: () => void;
  onSuggestionClick?: (text: string) => void;
  selectedChatModel: string;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  status: UseChatHelpers<ChatMessage>["status"];
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
    <div
      className={`mx-auto mt-2 mb-2 ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
    >
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm">
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
          <div className="max-h-40 overflow-auto rounded-md border border-border bg-background p-3 text-muted-foreground text-xs">
            <Markdown>{documentDraftMarkdown}</Markdown>
          </div>
          <div className="flex justify-end">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onOpenDocumentBuilder}
              size="sm"
              type="button"
            >
              Open in Document Builder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
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
  const lastScrollRef = useRef(0);

  useEffect(() => {
    if (status === "streaming") {
      // Throttle scroll during streaming to avoid jank
      const now = Date.now();
      if (now - lastScrollRef.current > 150) {
        lastScrollRef.current = now;
        scrollToBottom("instant");
      }
    } else if (status === "ready") {
      scrollToBottom("smooth");
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
    (im) => im.id === selectedChatModel
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

  return (
    <ScrollArea className="w-full flex-1 overflow-auto">
      <div className="p-4">
        {messages.length === 0 && !showThinking && !isGeneratingImage ? (
          <EmptyChatState onSuggestionClick={onSuggestionClick} />
        ) : (
          <>
            {messages.map((message, index) => (
              <Fragment key={message.id}>
                <div className={index > 0 ? "mt-6" : ""}>
                  <PreviewMessage
                    isDocumentSheetOpen={isDocumentSheetOpen}
                    isStreaming={
                      status === "streaming" &&
                      message.role === "assistant" &&
                      message.id === messages[messages.length - 1]?.id
                    }
                    message={message}
                  />
                </div>
                {documentDraftMarkdown &&
                  documentSourceMessageId === message.id && (
                    <DocumentCard
                      documentDraftFormat={documentDraftFormat}
                      documentDraftMarkdown={documentDraftMarkdown}
                      documentDraftTitle={documentDraftTitle}
                      isDocumentSheetOpen={isDocumentSheetOpen}
                      onOpenDocumentBuilder={onOpenDocumentBuilder}
                    />
                  )}
              </Fragment>
            ))}
          </>
        )}
        {showThinking && (
          <div
            className={`mx-auto mt-4 ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
          >
            <ThinkingIndicator />
          </div>
        )}
        {isGeneratingImage && (
          <div
            className={`mx-auto mt-4 ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
          >
            <motion.div
              animate={{ opacity: 1 }}
              className="relative size-72 overflow-hidden rounded-xl border border-border bg-muted/30"
              initial={{ opacity: 0 }}
            >
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/40 via-transparent to-muted/40" />
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-foreground/[0.02] to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <ImageIcon className="size-6 text-muted-foreground/40" />
                <div className="flex items-center gap-2 text-muted-foreground/60">
                  <LoaderIcon className="size-3.5 animate-spin" />
                  <span className="text-sm">Generating...</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  // Always re-render during streaming so streamed text appears in real time
  if (nextProps.status === "streaming" || prevProps.status === "streaming") {
    return false;
  }
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.selectedChatModel !== nextProps.selectedChatModel) {
    return false;
  }
  if (prevProps.isDocumentSheetOpen !== nextProps.isDocumentSheetOpen) {
    return false;
  }
  if (prevProps.documentDraftMarkdown !== nextProps.documentDraftMarkdown) {
    return false;
  }
  if (prevProps.documentDraftTitle !== nextProps.documentDraftTitle) {
    return false;
  }
  if (prevProps.documentDraftFormat !== nextProps.documentDraftFormat) {
    return false;
  }
  if (prevProps.documentSourceMessageId !== nextProps.documentSourceMessageId) {
    return false;
  }
  if (prevProps.onOpenDocumentBuilder !== nextProps.onOpenDocumentBuilder) {
    return false;
  }
  if (prevProps.onSuggestionClick !== nextProps.onSuggestionClick) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  return true;
});
