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
  isSourcesPanelOpen?: boolean;
  messages: ChatMessage[];
  onOpenDocumentBuilder?: () => void;
  onSuggestionClick?: (text: string) => void;
  selectedChatModel: string;
  status: UseChatHelpers<ChatMessage>["status"];
}

const CODE_BLOCK_REGEX = /```[\s\S]*?```/;

function getNarrowMaxWidth(narrow: boolean) {
  return narrow ? "max-w-2xl" : "max-w-3xl";
}

function DocumentCard({
  isNarrow,
  documentDraftMarkdown,
  documentDraftTitle,
  documentDraftFormat,
  onOpenDocumentBuilder,
}: {
  isNarrow: boolean;
  documentDraftMarkdown: string;
  documentDraftTitle?: string;
  documentDraftFormat: ExportFormat;
  onOpenDocumentBuilder?: () => void;
}) {
  const hasCodeBlock = CODE_BLOCK_REGEX.test(documentDraftMarkdown);

  return (
    <div className={`mx-auto mt-2 mb-2 ${getNarrowMaxWidth(isNarrow)}`}>
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
  isSourcesPanelOpen = false,
  documentDraftMarkdown,
  documentDraftTitle,
  documentDraftFormat = "docx",
  documentSourceMessageId,
  onOpenDocumentBuilder,
  onSuggestionClick,
}: MessagesProps) {
  const { containerRef, scrollUserMessageToTop, isNearBottom, scrollToBottom } =
    useMessages();
  let hasAssistantVisibleText = false;
  let hasAssistantImageAttachment = false;
  let lastAssistantMessageId: string | null = null;
  let latestUserMessageId: string | null = null;

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];

    if (message.role === "user" && latestUserMessageId === null) {
      latestUserMessageId = message.id;
    }

    if (message.role !== "assistant") {
      continue;
    }

    if (lastAssistantMessageId === null) {
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
    }

    if (latestUserMessageId !== null && lastAssistantMessageId !== null) {
      break;
    }
  }

  const isImageModelSelected = image_models.some(
    (im) => im.id === selectedChatModel
  );

  // Track which user message we already scrolled-to-top so we only fire
  // the snap once per submit, not on every status flip during a stream.
  const lastScrolledUserMessageId = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "submitted") {
      return;
    }
    if (!latestUserMessageId) {
      return;
    }
    if (lastScrolledUserMessageId.current === latestUserMessageId) {
      return;
    }
    lastScrolledUserMessageId.current = latestUserMessageId;
    scrollUserMessageToTop(latestUserMessageId);
  }, [latestUserMessageId, status, scrollUserMessageToTop]);

  // When a stream completes and the user is still tailing the conversation,
  // softly settle to the bottom — keeps short follow-ups feeling natural.
  useEffect(() => {
    if (status !== "ready") {
      return;
    }
    if (!lastAssistantMessageId) {
      return;
    }
    if (isNearBottom()) {
      scrollToBottom("smooth");
    }
  }, [status, lastAssistantMessageId, isNearBottom, scrollToBottom]);

  const showThinking =
    (status === "submitted" || status === "streaming") &&
    !hasAssistantVisibleText &&
    !isImageModelSelected;

  const isGeneratingImage =
    (status === "submitted" || status === "streaming") &&
    isImageModelSelected &&
    !hasAssistantImageAttachment;

  const isNarrow = isDocumentSheetOpen || isSourcesPanelOpen;
  const widthClass = getNarrowMaxWidth(isNarrow);

  // Reserve viewport room beneath the streaming response so the just-sent
  // user message can actually reach the top of the viewport even when the
  // assistant reply is short. Roughly: viewport height minus header + input.
  const isActivelyStreamingLast =
    (status === "streaming" || status === "submitted") &&
    !!lastAssistantMessageId;

  return (
    <ScrollArea className="w-full flex-1 overflow-auto" ref={containerRef}>
      <div className="p-4">
        {messages.length === 0 && !showThinking && !isGeneratingImage ? (
          <EmptyChatState onSuggestionClick={onSuggestionClick} />
        ) : (
          messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const wrapStreaming =
              isLast &&
              isActivelyStreamingLast &&
              message.id === lastAssistantMessageId;

            return (
              <Fragment key={message.id}>
                <div
                  className={index > 0 ? "mt-6" : ""}
                  style={
                    wrapStreaming
                      ? { minHeight: "calc(100vh - 18rem)" }
                      : undefined
                  }
                >
                  <PreviewMessage
                    isDocumentSheetOpen={isDocumentSheetOpen}
                    isSourcesPanelOpen={isSourcesPanelOpen}
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
                    isNarrow={isNarrow}
                    onOpenDocumentBuilder={onOpenDocumentBuilder}
                  />
                ) : null}
              </Fragment>
            );
          })
        )}
        {showThinking && (
          <div
            className={`mx-auto mt-4 ${widthClass}`}
            style={{ minHeight: "calc(100vh - 18rem)" }}
          >
            <ThinkingIndicator />
          </div>
        )}
        {isGeneratingImage && (
          <div className={`mx-auto mt-4 ${widthClass}`}>
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
  if (prevProps.isSourcesPanelOpen !== nextProps.isSourcesPanelOpen) {
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
