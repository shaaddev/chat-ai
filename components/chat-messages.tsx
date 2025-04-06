"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "./markdown";
import { Message } from "ai";
import { useEffect, useRef } from "react";

export interface messageProps {
  messages: Message[];
  isLoading?: boolean;
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
            className={`mb-4 flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={` px-5 py-2 rounded-xl flex flex-col w-full ${
                message.role === "user"
                  ? "bg-neutral-800 text-neutral-300"
                  : " text-neutral-100"
              }`}
            >
              <Markdown>{message.content as string}</Markdown>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
