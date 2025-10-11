"use client";

import { Markdown } from "./markdown";
import type { ChatMessage } from "@/lib/types";
import { PreviewAttachment } from "./preview-attachment";
import { memo } from "react";
import equal from "fast-deep-equal";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent } from "./message-content";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { stable_models } from "@/lib/ai/models";

export interface messageProps {
  message: ChatMessage;
}

const PureChatMessage = ({ message }: messageProps) => {
  const [copied, setCopied] = useState(false);

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file",
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

  const getModelName = (modelId: string | null | undefined) => {
    if (!modelId) return null;
    const model = stable_models.find((m) => m.id === modelId);
    return model?.name || modelId;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div
        key={message.id}
        className={`flex ${
          message.role === "user" ? "justify-end" : "justify-start"
        } ${message.role === "assistant" ? "group/message" : ""}`}
      >
        <div className="flex flex-col gap-6 w-full">
          {attachmentsFromMessage.length > 0 && (
            <div
              data-testid={`message-attachments`}
              className={`mt-3 flex flex-wrap gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={{
                    name:
                      // Prefer SDK-declared filename when available
                      ("filename" in attachment && attachment.filename) ||
                      // Fallback to custom name if present on the object
                      (("name" in attachment &&
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (attachment as any).name) as string) ||
                      "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  className=" size-80"
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
                  key={key}
                  className={cn(
                    "flex w-full",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <MessageContent
                    data-testid="message-content"
                    className={cn({
                      "bg-neutral-800 text-neutral-300 w-fit max-w-[80%] rounded-2xl px-5 py-2 break-words":
                        message.role === "user",
                      " text-neutral-100 px-0 py-0 text-left":
                        message.role === "assistant",
                    })}
                  >
                    <Markdown>{sanitizeText(part.text)}</Markdown>
                  </MessageContent>
                </div>
              );
            }
          })}
          {message.role === "assistant" && (
            <div
              className={cn(
                "flex w-full items-center gap-3 text-xs text-neutral-400 transition-opacity duration-150",
                "justify-start opacity-0 group-hover/message:opacity-100",
              )}
            >
              {typeof message.metadata === "object" &&
                message.metadata &&
                (() => {
                  const m = message.metadata as Record<string, unknown>;
                  const modelId = m.model as string | null | undefined;
                  const modelName = getModelName(modelId);

                  return (
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        onClick={handleCopyMessage}
                        className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2 py-1 hover:bg-neutral-700 transition-colors"
                        title="Copy message"
                      >
                        {copied ? (
                          <>
                            <Check className="size-3.5 text-green-400" />
                            <span className="text-green-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      {modelName && (
                        <div className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2 py-1">
                          <span className="text-neutral-300 font-medium">
                            {modelName}
                          </span>
                        </div>
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
  if (prevProps.message.id !== nextProps.message.id) return false;
  if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

  return false;
});
