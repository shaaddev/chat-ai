"use client";

import equal from "fast-deep-equal";
import { Check, Copy, Globe } from "lucide-react";
import { memo, useState } from "react";
import { motion } from "motion/react";
import { stable_models, image_models } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { Markdown } from "./markdown";
import { MessageContent } from "./message-content";
import { PreviewAttachment } from "./preview-attachment";

export interface messageProps {
  message: ChatMessage;
  isDocumentSheetOpen?: boolean;
  isStreaming?: boolean;
}

const PureChatMessage = ({
  message,
  isDocumentSheetOpen = false,
  isStreaming = false,
}: messageProps) => {
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
    const model =
      stable_models.find((m) => m.id === modelId) ||
      image_models.find((m) => m.id === modelId);
    return model?.name || modelId;
  };

  return (
    <div
      className={`mx-auto ${isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"}`}
    >
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
                      ("filename" in attachment && attachment.filename) ||
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
                      "bg-muted text-secondary-foreground w-fit max-w-[92%] sm:max-w-[80%] rounded-2xl px-5 py-2 break-words":
                        message.role === "user",
                      "text-foreground px-0 py-0 text-left border-l-2 border-primary/20 pl-4":
                        message.role === "assistant",
                    })}
                  >
                    <div
                      className={
                        isStreaming && message.role === "assistant"
                          ? "streaming-cursor"
                          : ""
                      }
                    >
                      <Markdown>{sanitizeText(part.text)}</Markdown>
                    </div>
                  </MessageContent>
                </div>
              );
            }
          })}
          {message.role === "assistant" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className={cn(
                "flex w-full items-center gap-3 text-xs text-muted-foreground transition-opacity duration-150",
                "justify-start opacity-0 group-hover/message:opacity-100",
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
                    <div className="mt-1 flex items-center gap-3">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCopyMessage}
                        className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
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
                      </motion.button>
                      {modelName && (
                        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                          <span className="text-muted-foreground font-medium">
                            {modelName}
                          </span>
                        </div>
                      )}
                      {usedSearch && (
                        <div
                          className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1"
                          title="Used web search"
                        >
                          <Globe className="size-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })()}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(PureChatMessage, (prevProps, nextProps) => {
  if (prevProps.message.id !== nextProps.message.id) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

  return false;
});
