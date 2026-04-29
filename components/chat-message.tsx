"use client";

import { Check, Copy, Globe } from "lucide-react";
import { memo, useState } from "react";
import { useSmoothText } from "@/hooks/use-smooth-text";
import { image_models, stable_models } from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Markdown } from "./markdown";
import { MessageContent } from "./message-content";
import { PreviewAttachment } from "./preview-attachment";

export interface messageProps {
  isDocumentSheetOpen?: boolean;
  isSourcesPanelOpen?: boolean;
  isStreaming?: boolean;
  message: ChatMessage;
}

function getModelName(modelId: string | null | undefined) {
  if (!modelId) {
    return null;
  }
  const model =
    stable_models.find((m) => m.id === modelId) ||
    image_models.find((m) => m.id === modelId);
  return model?.name || modelId;
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

function getMessageMaxWidthClass(
  isDocumentSheetOpen: boolean,
  isSourcesPanelOpen: boolean
) {
  if (isDocumentSheetOpen || isSourcesPanelOpen) {
    return "max-w-2xl";
  }
  return "max-w-3xl";
}

/**
 * Renders the actively streaming assistant text via `useSmoothText` so the
 * reveal cadence stays steady instead of flickering with network bursts.
 * Historical / non-streaming messages skip the hook entirely.
 */
function AssistantText({
  isStreaming,
  text,
}: {
  isStreaming: boolean;
  text: string;
}) {
  const sanitized = sanitizeText(text);
  const smoothed = useSmoothText(sanitized, isStreaming);
  return <Markdown>{smoothed}</Markdown>;
}

const PureChatMessage = ({
  message,
  isDocumentSheetOpen = false,
  isSourcesPanelOpen = false,
  isStreaming = false,
}: messageProps) => {
  const [copied, setCopied] = useState(false);
  const attachmentsFromMessage = getAttachmentsFromMessage(message);
  const isAssistant = message.role === "assistant";
  const widthClass = getMessageMaxWidthClass(
    isDocumentSheetOpen,
    isSourcesPanelOpen
  );

  const handleCopyMessage = async () => {
    const textContent = message.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join("\n");

    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`mx-auto ${widthClass}`}
      data-message-id={message.id}
      data-role={message.role}
    >
      <div
        className={cn(
          "flex",
          message.role === "user" ? "justify-end" : "justify-start",
          isAssistant && "group/message"
        )}
        key={message.id}
      >
        <div className="flex w-full flex-col gap-4">
          {attachmentsFromMessage.length > 0 && (
            <div
              className={cn(
                "mt-3 flex flex-wrap gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
              data-testid="message-attachments"
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={attachment}
                  className="size-80"
                  key={attachment.url}
                />
              ))}
            </div>
          )}
          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "text") {
              return (
                <div
                  className={cn(
                    "flex w-full",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                  key={key}
                >
                  <MessageContent
                    className={cn(
                      message.role === "user" &&
                        "w-fit max-w-[92%] break-words rounded-2xl bg-muted px-4 py-2.5 sm:max-w-[80%]",
                      isAssistant &&
                        "w-full max-w-[68ch] border-foreground/8 border-l py-0 pr-0 pl-5 text-left"
                    )}
                    data-testid="message-content"
                  >
                    {isAssistant ? (
                      <div
                        className={cn(
                          isStreaming && "streaming-cursor streaming-text"
                        )}
                      >
                        <AssistantText
                          isStreaming={isStreaming}
                          text={part.text}
                        />
                      </div>
                    ) : (
                      <Markdown>{sanitizeText(part.text)}</Markdown>
                    )}
                  </MessageContent>
                </div>
              );
            }

            return null;
          })}
          {isAssistant && (
            <div
              className={cn(
                "flex w-full items-center gap-2 text-xs transition-opacity duration-200",
                "justify-start opacity-0 group-hover/message:opacity-100"
              )}
            >
              {typeof message.metadata === "object" &&
                message.metadata &&
                (() => {
                  const m = message.metadata as Record<string, unknown>;
                  const modelId = m.model as string | null | undefined;
                  const modelName = getModelName(modelId);
                  const usedSearch = Boolean(m.useSearch);

                  return (
                    <div className="flex items-center gap-2 pl-5">
                      <button
                        className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={handleCopyMessage}
                        title="Copy message"
                        type="button"
                      >
                        {copied ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                      {modelName && (
                        <span className="text-[11px] text-muted-foreground/60">
                          {modelName}
                        </span>
                      )}
                      {usedSearch && (
                        <span title="Used web search">
                          <Globe className="size-3 text-muted-foreground/60" />
                        </span>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(PureChatMessage, (prevProps, nextProps) => {
  // Always re-render the actively streaming message
  if (nextProps.isStreaming || prevProps.isStreaming) {
    return false;
  }
  if (prevProps.isDocumentSheetOpen !== nextProps.isDocumentSheetOpen) {
    return false;
  }
  if (prevProps.isSourcesPanelOpen !== nextProps.isSourcesPanelOpen) {
    return false;
  }
  if (prevProps.message.id !== nextProps.message.id) {
    return false;
  }
  if (prevProps.message.role !== nextProps.message.role) {
    return false;
  }
  if (prevProps.message.parts !== nextProps.message.parts) {
    return false;
  }
  if (prevProps.message.metadata !== nextProps.message.metadata) {
    return false;
  }
  return true;
});
