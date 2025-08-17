"use client";

import { Markdown } from "./markdown";
import type { ChatMessage } from "@/lib/types";
import { PreviewAttachment } from "./preview-attachment";
import { memo } from "react";
import equal from "fast-deep-equal";

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
        className={` flex ${
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
                  data-testid="message-content"
                  className={`px-5 py-2 rounded-xl flex flex-col w-full ${
                    message.role === "user"
                      ? "bg-neutral-800 text-neutral-300"
                      : " text-neutral-100"
                  }`}
                >
                  <Markdown>{part.text}</Markdown>
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
