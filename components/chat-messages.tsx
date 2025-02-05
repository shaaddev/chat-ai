import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "./markdown";
import { Message } from "ai";
import { Skeleton } from "@/components/ui/skeleton";

export interface messageProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading }: messageProps) {
  return (
    <ScrollArea className="flex-1 p-4 w-full">
      <div className="max-w-3xl mx-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block px-5 py-2 rounded-xl ${
                message.role === "user"
                  ? "bg-neutral-800 text-neutral-300"
                  : " text-neutral-100"
              }`}
            >
              {isLoading && message.role === "assistant" ? (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-10 w-full bg-neutral-800" />
                </div>
              ) : (
                <Markdown>{message.content as string}</Markdown>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
