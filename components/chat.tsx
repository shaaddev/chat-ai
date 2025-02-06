"use client";
import { useChat, type Message } from "ai/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "next-view-transitions";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { generateUUID } from "@/lib/utils";

interface ChatProps {
  id: string;
  initialMessages?: Array<Message>;
}

export function Chat({ id, initialMessages }: ChatProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      id,
      initialMessages,
      generateId: generateUUID,
    });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-neutral-900 text-gray-100">
        <ChatHistory />

        <div className="flex flex-col flex-1 w-full">
          <header className="flex items-center p-4 border-b border-neutral-800">
            <SidebarTrigger>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </SidebarTrigger>
            <h1 className="text-xl font-bold">Chatbot</h1>
          </header>

          <ChatMessages isLoading={isLoading} messages={messages} />

          <div className="max-w-3xl mx-auto space-y-4 w-full">
            <p className="text-center text-sm text-gray-400">
              Make sure you agree to our{" "}
              <Link href="/terms" className="underline">
                Terms
              </Link>{" "}
              and our{" "}
              <Link href="/policy" className="underline">
                Privacy Policy
              </Link>
            </p>
            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              chatId={id}
            />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
