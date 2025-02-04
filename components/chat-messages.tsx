import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatMessages({ messages }: any) {
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
              className={`inline-block p-2 rounded-xl ${
                message.role === "user"
                  ? "bg-neutral-700 text-neutral-100"
                  : "bg-neutral-800 text-neutral-100"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
