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
    (part) => part.type === "file",
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
                    name: attachment.filename ?? "file",
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
