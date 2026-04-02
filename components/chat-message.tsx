"use client";

import equal from "fast-deep-equal";
import { Check, Copy, Globe } from "lucide-react";
import { memo, useState } from "react";
import { image_models, stable_models } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Markdown } from "./markdown";
import { MessageContent } from "./message-content";
import { PreviewAttachment } from "./preview-attachment";

export interface messageProps {
  isDocumentSheetOpen?: boolean;
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

const PureChatMessage = ({
  message,
  isDocumentSheetOpen = false,
  isStreaming = false,
}: messageProps) => {
  const [copied, setCopied] = useState(false);

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
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
      className={`mx-auto ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
    >
      <div
        className={cn(
          "flex",
          message.role === "user" ? "justify-end" : "justify-start",
          message.role === "assistant" && "group/message"
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
                  attachment={{
                    name:
                      ("filename" in attachment && attachment.filename) ||
                      (("name" in attachment &&
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (attachment as any).name) as string) ||
                      "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
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
                      message.role === "assistant" && "px-0 py-0 text-left"
                    )}
                    data-testid="message-content"
                  >
                    <div
                      className={cn(
                        isStreaming &&
                          message.role === "assistant" &&
                          "streaming-cursor"
                      )}
                    >
                      <Markdown>{sanitizeText(part.text)}</Markdown>
                    </div>
                  </MessageContent>
                </div>
              );
            }
          })}
          {message.role === "assistant" && (
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
                    <div className="flex items-center gap-2">
                      <button
                        className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={handleCopyMessage}
                        title="Copy message"
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
  if (!equal(prevProps.message.parts, nextProps.message.parts)) {
    return false;
  }
  return true;
});
