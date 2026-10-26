"use client";

import { Check, Copy, Globe } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import { memo, useState } from "react";
import { getModelLabel, getModelProvider } from "@/lib/ai/models";
import { extractSources, getFaviconUrl, type Source } from "@/lib/sources";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Markdown } from "./markdown";
import { MessageContent } from "./message-content";
import { ProviderDot } from "./model-helpful-tooltips";
import { PreviewAttachment } from "./preview-attachment";

const COPIED_FEEDBACK_MS = 2000;

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

interface MessageProps {
  isStreaming: boolean;
  message: ChatMessage;
}

function getAttachmentName(part: Record<string, unknown>) {
  if (typeof part.filename === "string" && part.filename.length > 0) {
    return part.filename;
  }

  if (typeof part.name === "string" && part.name.length > 0) {
    return part.name;
  }

  return "file";
}

function getAttachmentsFromMessage(message: ChatMessage): Attachment[] {
  const attachments: Attachment[] = [];

  for (const part of message.parts) {
    if (part.type !== "file") {
      continue;
    }

    const filePart = part as Record<string, unknown>;
    attachments.push({
      name: getAttachmentName(filePart),
      contentType: typeof part.mediaType === "string" ? part.mediaType : "",
      url: part.url,
    });
  }

  return attachments;
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

function SourceChips({ sources }: { sources: Source[] }) {
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
    </div>
  );
}

function PureChatMessage({ message, isStreaming }: MessageProps) {
  const [copied, setCopied] = useState(false);
  const attachments = getAttachmentsFromMessage(message);
  const isAssistant = message.role === "assistant";
  const lastPartIndex = message.parts.length - 1;
  const text = getMessageText(message);
  const modelId = message.metadata?.model;
  const usedSearch = message.metadata?.useSearch === true;
  const sources = isAssistant && !isStreaming ? extractSources(message) : [];

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <div data-message-id={message.id} data-role={message.role}>
      <div
        className={cn(
          "flex w-full flex-col",
          isAssistant ? "group/message" : "gap-2.5"
        )}
      >
        {isAssistant && modelId ? (
          <ModelChip modelId={modelId} usedSearch={usedSearch} />
        ) : null}
        {attachments.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap items-end gap-2.5",
              isAssistant ? "mb-2.5 justify-start" : "justify-end"
            )}
            data-testid="message-attachments"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                className="h-28 w-[184px]"
                key={attachment.url}
              />
            ))}
          </div>
        )}
        {message.parts.map((part, index) => {
          if (part.type !== "text" || part.text.trim().length === 0) {
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
                <Markdown isStreaming={isStreaming && index === lastPartIndex}>
                  {sanitizeText(part.text)}
                </Markdown>
              </MessageContent>
            </div>
          );
        })}
        {isAssistant && !isStreaming && (
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            <SourceChips sources={sources} />
            {text.length > 0 && (
              <div className="ml-auto flex gap-0.5 pointer-fine:opacity-0 transition-opacity duration-200 focus-within:opacity-100 pointer-fine:group-hover/message:opacity-100">
                <button
                  aria-label={copied ? "Copied" : "Copy message"}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={handleCopyMessage}
                  type="button"
                >
                  {copied ? (
                    <Check aria-hidden className="size-4" />
                  ) : (
                    <Copy aria-hidden className="size-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const PreviewMessage = memo(PureChatMessage);
