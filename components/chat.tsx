"use client";
import { useChat, type Message } from "ai/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { generateUUID } from "@/lib/utils";
import { useState } from "react";
import { Session } from "@/lib/auth";
import type { Attachment } from "ai";
import { toast } from "sonner";

interface ChatProps {
  id: string;
  session: Session | null;
  initialChatModel: string;
  initialMessages?: Array<Message>;
}

export function Chat({
  id,
  initialChatModel,
  initialMessages,
  session,
}: ChatProps) {
  const [isAuthenticated] = useState(session ? true : false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
  } = useChat({
    api: "/api/chat",
    id,
    body: {
      id,
      selectedChatModel: initialChatModel,
    },
    initialMessages,
    generateId: generateUUID,
    onError: (err) => {
      toast.error("Error", {
        description: err.message,
      });
    },
  });

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-neutral-900 text-gray-100">
        <ChatHistory session={session} />

        <div className="flex flex-col flex-1 w-full">
          <header className="flex items-center p-4 gap-2">
            <SidebarTrigger className="rounded-xl">
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="size-5 inline-block" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </SidebarTrigger>
            <h1 className="text-xl font-bold">chat</h1>
          </header>

          <div className="flex flex-col flex-1 w-full border-l border-t rounded-tl-2xl overflow-hidden">
            <ChatMessages status={status} messages={messages} />

            <div className="max-w-3xl mx-auto space-y-4 w-full">
              <p className="text-center text-sm text-gray-400">shaaddev</p>
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                status={status}
                chatId={id}
                initialChatModel={initialChatModel}
                isAuthenticated={isAuthenticated}
                attachments={attachments}
                setAttachments={setAttachments}
                setMessages={setMessages}
              />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
