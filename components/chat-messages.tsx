import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDown, FileText, ImageIcon, LoaderIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, memo, useEffect, useRef, useState } from "react";
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

function ScrollToBottomButton({
  show,
  onClick,
}: {
  show: boolean;
  onClick: () => void;
}) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          aria-label="Scroll to latest message"
          className="absolute bottom-4 left-1/2 z-20 inline-flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-foreground/10 bg-background/90 text-foreground/80 shadow-md backdrop-blur transition-colors hover:border-foreground/25 hover:text-foreground"
          exit={{ opacity: 0, y: 8 }}
          initial={{ opacity: 0, y: 8 }}
          onClick={onClick}
          transition={{ duration: 0.18, ease: "easeOut" }}
          type="button"
        >
          <ArrowDown className="size-4" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

function PureMessages({
  chatId,
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
  const { containerRef, isAtBottom, scrollToBottom, scrollUserMessageToTop } =
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

  // Scroll the just-sent user message to the top of the viewport once per
  // submission. Tracked by ref so we don't re-fire on every re-render.
  const lastScrolledUserMessageId = useRef<string | null>(null);

  // The "active exchange anchor" — the id of the user message whose
  // response we're currently showing. Set on submit and held all the way
  // through `ready`, so the min-height wrapper stays in place even after
  // streaming ends. Resets when the user starts a new exchange or
  // navigates to a different chat.
  const [exchangeAnchorId, setExchangeAnchorId] = useState<string | null>(null);

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
    setExchangeAnchorId(latestUserMessageId);
    scrollUserMessageToTop(latestUserMessageId);
  }, [latestUserMessageId, status, scrollUserMessageToTop]);

  // After streaming finishes for a short response, the natural document
  // height could shrink below the viewport — which would cause the
  // browser to clamp scrollTop and kick the user message off the top.
  // Re-pin the user message at the top once layout has settled.
  useEffect(() => {
    if (status !== "ready") {
      return;
    }
    if (!exchangeAnchorId) {
      return;
    }
    // Two-phase pin: once now, once after the next paint, to catch the
    // moment the assistant text finishes its smooth-reveal animation.
    scrollUserMessageToTop(exchangeAnchorId);
  }, [status, exchangeAnchorId, scrollUserMessageToTop]);

  // On chat load (or chat-id change), jump straight to the bottom so the
  // user sees the latest exchange first. Fires once per chatId, and also
  // resets the active-exchange anchor.
  const initialScrollAppliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (initialScrollAppliedFor.current === chatId) {
      return;
    }
    if (messages.length === 0) {
      initialScrollAppliedFor.current = chatId;
      setExchangeAnchorId(null);
      return;
    }
    initialScrollAppliedFor.current = chatId;
    setExchangeAnchorId(null);
    lastScrolledUserMessageId.current = null;
    // Two passes: the first kicks off before layout fully settles, the
    // second nails it once Radix has painted scroll content.
    scrollToBottom("instant");
    requestAnimationFrame(() => scrollToBottom("instant"));
  }, [chatId, messages.length, scrollToBottom]);

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

  // Reserve viewport room beneath the latest message for the duration of
  // the active exchange. This keeps the just-sent user message pinned
  // near the top of the viewport even when the assistant response is
  // short — without the room, the document collapses below viewport
  // height and the browser snaps the user message off the top.
  const hasActiveExchange = exchangeAnchorId !== null;

  const showScrollButton =
    !isAtBottom && messages.length > 0 && status !== "submitted";

  return (
    <div className="relative w-full flex-1 overflow-hidden">
      <ScrollArea className="h-full w-full" ref={containerRef}>
        <div className="p-4">
          {messages.length === 0 && !showThinking && !isGeneratingImage ? (
            <EmptyChatState onSuggestionClick={onSuggestionClick} />
          ) : (
            messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              const wrapForScroll = isLast && hasActiveExchange;

              return (
                <Fragment key={message.id}>
                  <div
                    className={index > 0 ? "mt-6" : ""}
                    style={
                      wrapForScroll
                        ? { minHeight: "calc(100vh - 14rem)" }
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
                    {showThinking && isLast && message.role === "user" ? (
                      <div className={`mx-auto mt-6 ${widthClass}`}>
                        <ThinkingIndicator />
                      </div>
                    ) : null}
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
      <ScrollToBottomButton
        onClick={() => scrollToBottom("smooth")}
        show={showScrollButton}
      />
    </div>
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
