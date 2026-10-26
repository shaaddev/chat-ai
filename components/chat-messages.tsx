import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDown, FileText, ImageIcon } from "lucide-react";
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
import type { ChatMessage, DocumentDraft } from "@/lib/types";
import { cn, hasVisibleContent } from "@/lib/utils";
import { PreviewMessage } from "./chat-message";
import { EmptyChatState } from "./empty-chat-state";
import { Markdown } from "./markdown";
import { ThinkingIndicator } from "./thinking-indicator";

interface MessagesProps {
  chatId: string;
  documentDraft: DocumentDraft | null;
  isImageModelSelected: boolean;
  isNarrow: boolean;
  messages: ChatMessage[];
  onOpenDocumentBuilder: () => void;
  onSuggestionClick: (text: string) => void;
  status: UseChatHelpers<ChatMessage>["status"];
}

const CODE_BLOCK_REGEX = /```[\s\S]*?```/;

function DocumentCard({
  draft,
  onOpenDocumentBuilder,
}: {
  draft: DocumentDraft;
  onOpenDocumentBuilder: () => void;
}) {
  const hasCodeBlock = CODE_BLOCK_REGEX.test(draft.markdown);

  return (
    <div className="mt-2 mb-2">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm">
            <FileText aria-hidden className="size-4" />
            Document draft ready
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {draft.title} ({draft.format.toUpperCase()})
            {hasCodeBlock && (
              <span className="ml-2 text-muted-foreground/70">
                &middot; Contains code
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-40 overflow-auto rounded-md border border-border bg-background p-3 text-muted-foreground text-xs">
            <Markdown>{draft.markdown}</Markdown>
          </div>
          <div className="flex justify-end">
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onOpenDocumentBuilder}
              size="sm"
              type="button"
            >
              Open in document builder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PendingReply({ isImage }: { isImage: boolean }) {
  if (isImage) {
    return (
      <motion.div
        animate={{ opacity: 1 }}
        className="mt-6 flex size-72 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ImageIcon aria-hidden className="size-6 text-muted-foreground" />
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span aria-hidden>Generating image</span>
          <ThinkingIndicator label="Generating image" />
        </div>
      </motion.div>
    );
  }
  return (
    <div className="mt-6 flex w-full max-w-[68ch] border-foreground/8 border-l pl-5">
      <ThinkingIndicator />
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
  isImageModelSelected,
  isNarrow,
  documentDraft,
  onOpenDocumentBuilder,
  onSuggestionClick,
}: MessagesProps) {
  const { containerRef, isAtBottom, scrollToBottom, scrollUserMessageToTop } =
    useMessages();

  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const streamingMessageId =
    status === "streaming" && lastMessage?.role === "assistant"
      ? lastMessage.id
      : null;
  const isAwaitingContent =
    isBusy &&
    lastMessage !== undefined &&
    (lastMessage.role === "user" || !hasVisibleContent(lastMessage));
  const visibleMessages = messages.filter(hasVisibleContent);
  const latestUserMessageId =
    messages.findLast((message) => message.role === "user")?.id ?? null;

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
          {visibleMessages.length === 0 && !isBusy ? (
            <EmptyChatState onSuggestionClick={onSuggestionClick} />
          ) : (
            <div
              className={cn("mx-auto", isNarrow ? "max-w-2xl" : "max-w-3xl")}
            >
              {visibleMessages.map((message, index) => {
                const isLast = index === visibleMessages.length - 1;

                return (
                  <Fragment key={message.id}>
                    <div
                      className={index > 0 ? "mt-6" : ""}
                      style={
                        isLast && hasActiveExchange
                          ? { minHeight: "calc(100dvh - 14rem)" }
                          : undefined
                      }
                    >
                      <PreviewMessage
                        isStreaming={message.id === streamingMessageId}
                        message={message}
                      />
                      {isLast && isAwaitingContent ? (
                        <PendingReply isImage={isImageModelSelected} />
                      ) : null}
                    </div>
                    {documentDraft?.messageId === message.id &&
                    documentDraft.markdown ? (
                      <DocumentCard
                        draft={documentDraft}
                        onOpenDocumentBuilder={onOpenDocumentBuilder}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
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

export const Messages = memo(PureMessages);
