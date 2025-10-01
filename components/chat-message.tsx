"use client";

import { Markdown } from "./markdown";
import type { ChatMessage } from "@/lib/types";
import { PreviewAttachment } from "./preview-attachment";
import { memo } from "react";
import equal from "fast-deep-equal";
import { cn, sanitizeText } from "@/lib/utils";
import { MessageContent } from "./message-content";

export interface messageProps {
  message: ChatMessage;
}

const PureChatMessage = ({ message }: messageProps) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div
        key={message.id}
        className={`flex ${
          message.role === "user" ? "justify-end" : "justify-start"
        }`}
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
                    message.role === "user" ? "justify-end" : "justify-start"
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
                "flex w-full text-xs text-neutral-400",
                "justify-start"
              )}
            >
              {typeof message.metadata === "object" &&
                message.metadata &&
                // common places token usage may be included
                // ai-sdk sometimes nests usage under metadata.usage.totalTokens
                // also support flat metadata.total_tokens or metadata.totalTokens
                (() => {
                  const m = message.metadata as Record<string, unknown>;
                  const usage = (m.usage as Record<string, unknown>) || {};
                  const totalFromUsage =
                    (usage.totalTokens as number) ??
                    (usage.total_tokens as number);
                  const totalFlat =
                    (m.totalTokens as number) ?? (m.total_tokens as number);
                  const total = totalFromUsage ?? totalFlat;
                  if (typeof total === "number") {
                    return (
                      <div className="mt-1 pl-1">{`Tokens: ${total}`}</div>
                    );
                  }
                  return null;
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
