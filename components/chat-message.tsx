"use client";

import { Check, Copy, Globe } from "lucide-react";
import { memo, useState } from "react";
import { findChatModel } from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Markdown } from "./markdown";
import { MessageContent } from "./message-content";
import { PreviewAttachment } from "./preview-attachment";

const COPIED_FEEDBACK_MS = 2000;

interface MessageProps {
  isStreaming: boolean;
  message: ChatMessage;
}

function getModelName(modelId: string | null | undefined) {
  if (!modelId) {
    return null;
  }
  return findChatModel(modelId)?.name ?? modelId;
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

function PureChatMessage({ message, isStreaming }: MessageProps) {
  const [copied, setCopied] = useState(false);
  const attachments = getAttachmentsFromMessage(message);
  const isAssistant = message.role === "assistant";
  const lastPartIndex = message.parts.length - 1;
  const text = getMessageText(message);
  const modelName = getModelName(message.metadata?.model);
  const usedSearch = message.metadata?.useSearch === true;

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <div data-message-id={message.id} data-role={message.role}>
      <div
        className={cn(
          "flex w-full flex-col gap-4",
          isAssistant && "group/message"
        )}
      >
        {attachments.length > 0 && (
          <div
            className={cn(
              "mt-3 flex flex-wrap gap-3",
              isAssistant ? "justify-start" : "justify-end"
            )}
            data-testid="message-attachments"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                className="size-80"
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
                    ? "w-full max-w-[68ch] border-foreground/8 border-l py-0 pr-0 pl-5 text-left"
                    : "w-fit max-w-[92%] break-words rounded-2xl bg-muted px-4 py-2.5 sm:max-w-[80%]"
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
          <div className="flex items-center gap-2 pl-5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/message:opacity-100">
            {text.length > 0 && (
              <button
                aria-label={copied ? "Copied" : "Copy message"}
                className="flex cursor-pointer items-center rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={handleCopyMessage}
                type="button"
              >
                {copied ? (
                  <Check aria-hidden className="size-4" />
                ) : (
                  <Copy aria-hidden className="size-4" />
                )}
              </button>
            )}
            {modelName && (
              <span className="text-muted-foreground text-xs">{modelName}</span>
            )}
            {usedSearch && (
              <Globe
                aria-label="Used web search"
                className="size-3 text-muted-foreground"
                role="img"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const PreviewMessage = memo(PureChatMessage);
