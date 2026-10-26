"use client";

import { Globe, Pencil, RotateCw } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import { memo, useEffect, useRef } from "react";
import { getModelLabel, getModelProvider } from "@/lib/ai/models";
import type { SettleFailure, UnsettledSubject } from "@/lib/chat-turn";
import {
  type EmptyReplyReason,
  getEmptyReplyReason,
  getReasoningText,
} from "@/lib/message-display";
import {
  extractSources,
  getFaviconUrl,
  SOURCES_PANEL_ID,
  type Source,
} from "@/lib/sources";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Markdown } from "./markdown";
import { ActionButton, CopyButton, MessageActions } from "./message-actions";
import { MessageAttachments } from "./message-attachments";
import { MessageContent } from "./message-content";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { ProviderDot } from "./model-helpful-tooltips";

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

export interface EditControls {
  cancel: () => void;
  start: (messageId: string) => void;
  submit: (message: ChatMessage, text: string) => void;
}

export interface ReplyControls {
  onEditPrompt: () => void;
  onRegenerate: () => void;
  regenerateLabel: string;
}

interface MessageProps {
  edit?: EditControls;
  isEditing: boolean;
  isSourcesOpen: boolean;
  isStreaming: boolean;
  message: ChatMessage;
  onToggleSources: (messageId: string) => void;
  reply?: ReplyControls;
  unsavedEditText?: string;
}

function getMessageText(message: ChatMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function ModelChip({
  modelId,
  usedSearch,
}: {
  modelId: string;
  usedSearch: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-[7px] font-medium text-[13px] text-muted-foreground">
      <ProviderDot provider={getModelProvider(modelId)} />
      {getModelLabel(modelId)}
      {usedSearch && (
        <Globe aria-label="Used web search" className="size-3.5" role="img" />
      )}
    </div>
  );
}

function SourceChips({
  isOpen,
  onToggle,
  sources,
}: {
  isOpen: boolean;
  onToggle: () => void;
  sources: Source[];
}) {
  if (sources.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {sources.map((source) => (
        <a
          className="inline-flex h-7 max-w-52 items-center gap-[7px] rounded-full bg-secondary pr-[11px] pl-[7px] text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={source.url}
          key={source.id}
          rel="noopener noreferrer"
          target="_blank"
          title={source.title}
        >
          <Image
            alt=""
            className="size-3.5 shrink-0 rounded-full"
            height={14}
            loader={passthroughImageLoader}
            src={getFaviconUrl(source.domain)}
            unoptimized
            width={14}
          />
          <span className="truncate">{source.domain}</span>
        </a>
      ))}
      <button
        aria-controls={isOpen ? SOURCES_PANEL_ID : undefined}
        aria-expanded={isOpen}
        className="inline-flex h-7 cursor-pointer items-center rounded-full px-[11px] text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-secondary aria-expanded:text-foreground"
        onClick={onToggle}
        type="button"
      >
        {sources.length === 1 ? "1 source" : `${sources.length} sources`}
      </button>
    </div>
  );
}

type ReplyNoticeReason = EmptyReplyReason | "missing";

const EMPTY_REPLY_SUMMARY: Record<ReplyNoticeReason, string> = {
  length: "The reply hit its length limit before writing any text.",
  missing: "This message has no reply yet.",
  other: "The model ended its turn without writing a reply.",
};

function ThreadNotice({
  action,
  hint,
  summary,
}: {
  action?: { label: string; onClick: () => void };
  hint: string;
  summary: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl bg-secondary py-3 pr-3 pl-4 text-sm"
      role="status"
    >
      <p className="min-w-0 flex-1 leading-normal">
        <span className="font-medium">{summary}</span>{" "}
        <span className="text-muted-foreground">{hint}</span>
      </p>
      {action ? (
        <button
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] bg-card px-3 font-medium text-[13px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={action.onClick}
          type="button"
        >
          <RotateCw aria-hidden className="size-3.5" />
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyReplyNotice({
  onRegenerate,
  reason,
}: {
  onRegenerate?: () => void;
  reason: ReplyNoticeReason;
}) {
  return (
    <ThreadNotice
      action={
        onRegenerate
          ? { label: "Regenerate", onClick: onRegenerate }
          : undefined
      }
      hint={
        onRegenerate
          ? "Regenerate to try again, or pick another model first."
          : "Pick another model and send the message again."
      }
      summary={EMPTY_REPLY_SUMMARY[reason]}
    />
  );
}

const UNSETTLED_SUMMARY: Record<UnsettledSubject, string> = {
  message: "Couldn't confirm your message was sent.",
  regeneration: "Couldn't confirm the reply was regenerated.",
  reply: "Couldn't confirm this reply was saved.",
};

export const SETTLE_FAILURE_HINT: Record<SettleFailure, string> = {
  offline: "Check your connection and try again.",
  server: "Try again in a moment.",
};

export function UnsettledNotice({
  onRetry,
  reason,
  subject,
}: {
  onRetry: () => void;
  reason: SettleFailure;
  subject: UnsettledSubject;
}) {
  return (
    <ThreadNotice
      action={{ label: "Try again", onClick: onRetry }}
      hint={SETTLE_FAILURE_HINT[reason]}
      summary={UNSETTLED_SUMMARY[subject]}
    />
  );
}

function PureChatMessage({
  edit,
  isEditing,
  isSourcesOpen,
  isStreaming,
  message,
  onToggleSources,
  reply,
  unsavedEditText,
}: MessageProps) {
  const isAssistant = message.role === "assistant";
  const text = getMessageText(message);
  const reasoningText = isAssistant ? getReasoningText(message) : "";
  const emptyReplyReason = isStreaming ? null : getEmptyReplyReason(message);
  const modelId = message.metadata?.model;
  const usedSearch = message.metadata?.useSearch === true;
  const sources = isAssistant && !isStreaming ? extractSources(message) : [];
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingRef = useRef(isEditing);

  useEffect(() => {
    const focusWasDropped =
      document.activeElement === null ||
      document.activeElement === document.body;
    if (wasEditingRef.current && !isEditing && focusWasDropped) {
      editButtonRef.current?.focus();
    }
    wasEditingRef.current = isEditing;
  }, [isEditing]);

  return (
    <div data-message-id={message.id} data-role={message.role}>
      <div
        className={cn(
          "group/message flex w-full flex-col",
          !isAssistant && "gap-2.5"
        )}
      >
        {isAssistant && modelId ? (
          <ModelChip modelId={modelId} usedSearch={usedSearch} />
        ) : null}
        {reasoningText ? (
          <MessageReasoning
            isThinking={isStreaming && text.length === 0}
            text={reasoningText}
          />
        ) : null}
        <MessageAttachments message={message} />
        {isEditing && edit ? (
          <MessageEditor
            initialText={unsavedEditText ?? text}
            onCancel={edit.cancel}
            onSubmit={(nextText) => edit.submit(message, nextText)}
          />
        ) : null}
        {message.parts.map((part, index) => {
          if (
            isEditing ||
            part.type !== "text" ||
            part.text.trim().length === 0
          ) {
            return null;
          }
          return (
            <div
              className={cn(
                "flex w-full",
                isAssistant ? "justify-start" : "justify-end"
              )}
              key={`message-${message.id}-part-${index}`}
            >
              <MessageContent
                className={cn(
                  isAssistant
                    ? "w-full text-left"
                    : "w-fit max-w-[88%] break-words rounded-[18px] bg-secondary px-4 py-[9px] sm:max-w-[80%]"
                )}
                data-testid="message-content"
              >
                <Markdown
                  isStreaming={isStreaming && part.state === "streaming"}
                  runnable={isAssistant}
                >
                  {sanitizeText(part.text)}
                </Markdown>
              </MessageContent>
            </div>
          );
        })}
        {emptyReplyReason ? (
          <EmptyReplyNotice
            onRegenerate={reply?.onRegenerate}
            reason={emptyReplyReason}
          />
        ) : null}
        {isAssistant && !isStreaming && !emptyReplyReason && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            <SourceChips
              isOpen={isSourcesOpen}
              onToggle={() => onToggleSources(message.id)}
              sources={sources}
            />
            {(text.length > 0 || reply) && (
              <MessageActions className="ml-auto">
                {text.length > 0 && <CopyButton text={text} />}
                {reply ? (
                  <>
                    <ActionButton
                      icon={RotateCw}
                      label={reply.regenerateLabel}
                      onClick={reply.onRegenerate}
                    />
                    <ActionButton
                      icon={Pencil}
                      label="Edit prompt"
                      onClick={reply.onEditPrompt}
                    />
                  </>
                ) : null}
              </MessageActions>
            )}
          </div>
        )}
        {isAssistant ? null : (
          <MessageActions
            className={cn("-mt-1.5 justify-end", isEditing && "invisible")}
          >
            {text.length > 0 && <CopyButton text={text} />}
            {edit ? (
              <ActionButton
                icon={Pencil}
                label="Edit message"
                onClick={() => edit.start(message.id)}
                ref={editButtonRef}
              />
            ) : null}
          </MessageActions>
        )}
      </div>
    </div>
  );
}

export const PreviewMessage = memo(PureChatMessage);
