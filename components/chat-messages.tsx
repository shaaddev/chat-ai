import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDown, FileText, ImageIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
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
import { type ChatModelId, getModelLabel } from "@/lib/ai/models";
import { focusComposer } from "@/lib/composer";
import { endsWithoutReply, isShownInThread } from "@/lib/message-display";
import type { ChatMessage, DocumentDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  type EditControls,
  EmptyReplyNotice,
  PreviewMessage,
  type ReplyControls,
} from "./chat-message";
import { Markdown } from "./markdown";
import { ThinkingIndicator } from "./thinking-indicator";

interface MessagesProps {
  chatId: string;
  documentDraft: DocumentDraft | null;
  isImageModelSelected: boolean;
  isNarrow: boolean;
  messages: ChatMessage[];
  onEditMessage: (message: ChatMessage, text: string) => void;
  onOpenDocumentBuilder: () => void;
  onRegenerate: () => void;
  onToggleSources: (messageId: string) => void;
  selectedModelId: ChatModelId;
  sendWasRefused: boolean;
  sourcesMessageId: string | null;
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
      <Card className="gap-4 border-0 bg-secondary py-5 shadow-none">
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
          <div className="max-h-40 overflow-auto rounded-lg bg-card p-3 text-muted-foreground text-xs">
            <Markdown isStreaming={draft.isStreaming}>
              {draft.markdown}
            </Markdown>
          </div>
          <div className="flex justify-end">
            <Button
              className="rounded-lg"
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
        className="mt-5 flex size-72 flex-col items-center justify-center gap-3 rounded-xl bg-secondary"
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
    <div className="mt-5 flex w-full">
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
          className="touch-hitbox absolute bottom-4 left-1/2 z-20 inline-flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-popover text-muted-foreground shadow-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          exit={{ opacity: 0, y: 8 }}
          initial={{ opacity: 0, y: 8 }}
          onClick={onClick}
          transition={{ duration: 0.18, ease: "easeOut" }}
          type="button"
        >
          <ArrowDown aria-hidden className="size-4" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

function PureMessages({
  chatId,
  messages,
  status,
  sendWasRefused,
  isImageModelSelected,
  isNarrow,
  documentDraft,
  onEditMessage,
  onOpenDocumentBuilder,
  onRegenerate,
  onToggleSources,
  selectedModelId,
  sourcesMessageId,
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
    (lastMessage.role === "user" || !isShownInThread(lastMessage));
  const visibleMessages = messages.filter(isShownInThread);
  const isMissingReply =
    !(isBusy || sendWasRefused) && endsWithoutReply(messages);
  const latestUserMessageId =
    messages.findLast((message) => message.role === "user")?.id ?? null;

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  if (isBusy && editingMessageId !== null) {
    setEditingMessageId(null);
  }

  const editControls = useMemo<EditControls>(
    () => ({
      cancel: () => setEditingMessageId(null),
      start: setEditingMessageId,
      submit: (message, text) => {
        setEditingMessageId(null);
        onEditMessage(message, text);
        focusComposer();
      },
    }),
    [onEditMessage]
  );

  const latestReplyId =
    !isBusy && lastMessage?.role === "assistant" ? lastMessage.id : null;
  const regenerateLabel = `Regenerate with ${getModelLabel(selectedModelId)}`;
  const replyControls = useMemo<ReplyControls | undefined>(() => {
    if (!(latestReplyId && latestUserMessageId)) {
      return;
    }
    return {
      onEditPrompt: () => setEditingMessageId(latestUserMessageId),
      onRegenerate,
      regenerateLabel,
    };
  }, [latestReplyId, latestUserMessageId, onRegenerate, regenerateLabel]);

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
      <ScrollArea
        className="h-full w-full [mask-image:linear-gradient(to_bottom,black_calc(100%-48px),transparent)]"
        ref={containerRef}
      >
        <div className="px-4 pt-1 pb-12 md:px-6">
          {visibleMessages.length === 0 && !isBusy ? null : (
            <div
              className={cn(
                "mx-auto",
                isNarrow ? "max-w-2xl" : "max-w-[720px]"
              )}
            >
              {visibleMessages.map((message, index) => {
                const isLast = index === visibleMessages.length - 1;

                return (
                  <Fragment key={message.id}>
                    <div
                      className={cn(
                        index > 0 && message.role === "assistant" && "mt-1.5",
                        index > 0 && message.role !== "assistant" && "mt-7"
                      )}
                      style={
                        isLast && hasActiveExchange
                          ? { minHeight: "calc(100dvh - 14rem)" }
                          : undefined
                      }
                    >
                      <PreviewMessage
                        edit={isBusy ? undefined : editControls}
                        isEditing={message.id === editingMessageId}
                        isSourcesOpen={message.id === sourcesMessageId}
                        isStreaming={message.id === streamingMessageId}
                        message={message}
                        onToggleSources={onToggleSources}
                        reply={
                          message.id === latestReplyId
                            ? replyControls
                            : undefined
                        }
                      />
                      {isLast && isAwaitingContent ? (
                        <PendingReply isImage={isImageModelSelected} />
                      ) : null}
                      {isLast && isMissingReply ? (
                        <div className="mt-5">
                          <EmptyReplyNotice
                            onRegenerate={onRegenerate}
                            reason="missing"
                          />
                        </div>
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
