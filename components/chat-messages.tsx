"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "./markdown";
import { Message } from "ai";
import { useEffect, useRef } from "react";
import { PreviewAttachment } from "./preview-attachment";
import { UseChatHelpers } from "ai/react";

export interface messageProps {
  messages: Message[];
  status: UseChatHelpers["status"];
}

export function ChatMessages({ messages }: messageProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4 w-full">
      <div className="max-w-3xl mx-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={` flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div className="flex flex-col gap-6 w-full">
              {message.experimental_attachments && (
                <div
                  data-testid={`message-attachments`}
                  className={`mt-3 flex flex-wrap gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.experimental_attachments.map((attachment, index) => (
                    <PreviewAttachment
                      key={`${message.id}-attachment-${index}`}
                      attachment={attachment}
                      className="size-72"
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
        ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
