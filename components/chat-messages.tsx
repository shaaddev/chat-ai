import type { UseChatHelpers } from "@ai-sdk/react";
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
  status: UseChatHelpers<ChatMessage>["status"];
}

const CODE_BLOCK_REGEX = /```[\s\S]*?```/;

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
  const hasCodeBlock = CODE_BLOCK_REGEX.test(documentDraftMarkdown);

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
  chatId: _chatId,
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
  const { messagesEndRef, scrollToBottom } = useMessages();
  const lastScrollRef = useRef(0);
  let hasAssistantVisibleText = false;
  let hasAssistantImageAttachment = false;
  let lastAssistantMessageId: string | null = null;
  const lastMessage = messages.at(-1);

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];

    if (message.role !== "assistant") {
      continue;
    }

    lastAssistantMessageId = message.id;

    for (const part of message.parts) {
      if (
        !hasAssistantVisibleText &&
        part.type === "text" &&
        part.text.trim().length > 0
      ) {
        hasAssistantVisibleText = true;
      }

      if (!hasAssistantImageAttachment && part.type === "file") {
        hasAssistantImageAttachment = true;
      }
    }

    break;
  }

  const isImageModelSelected = image_models.some(
    (im) => im.id === selectedChatModel
  );
  const lastMessageId = lastMessage?.id ?? null;

  useEffect(() => {
    if (!lastMessageId && messages.length === 0 && status !== "ready") {
      return;
    }

    if (status === "streaming") {
      const now = Date.now();
      if (now - lastScrollRef.current > 150) {
        lastScrollRef.current = now;
        scrollToBottom("instant");
      }
      return;
    }

    if (status === "ready") {
      scrollToBottom("smooth");
    }
  }, [lastMessageId, messages, scrollToBottom, status]);

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
          messages.map((message, index) => (
            <Fragment key={message.id}>
              <div className={index > 0 ? "mt-6" : ""}>
                <PreviewMessage
                  isDocumentSheetOpen={isDocumentSheetOpen}
                  isStreaming={
                    status === "streaming" &&
                    message.role === "assistant" &&
                    message.id === lastAssistantMessageId
                  }
                  message={message}
                />
              </div>
              {documentDraftMarkdown &&
              documentSourceMessageId === message.id ? (
                <DocumentCard
                  documentDraftFormat={documentDraftFormat}
                  documentDraftMarkdown={documentDraftMarkdown}
                  documentDraftTitle={documentDraftTitle}
                  isDocumentSheetOpen={isDocumentSheetOpen}
                  onOpenDocumentBuilder={onOpenDocumentBuilder}
                />
              ) : null}
            </Fragment>
          ))
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
  if (prevProps.chatId !== nextProps.chatId) {
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
  const prevFirstMessage = prevProps.messages[0];
  const nextFirstMessage = nextProps.messages[0];
  if (prevFirstMessage?.id !== nextFirstMessage?.id) {
    return false;
  }
  const prevLastMessage = prevProps.messages.at(-1);
  const nextLastMessage = nextProps.messages.at(-1);
  if (prevLastMessage?.id !== nextLastMessage?.id) {
    return false;
  }
  if (prevLastMessage?.parts !== nextLastMessage?.parts) {
    return false;
  }
  if (prevLastMessage?.metadata !== nextLastMessage?.metadata) {
    return false;
  }
  return true;
});
