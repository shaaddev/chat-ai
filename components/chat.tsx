"use client";
import { useChat, type Message } from "ai/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { generateUUID } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Session } from "@/lib/auth";
import type { Attachment } from "@/lib/types";
import { toast } from "sonner";
import { useChat as useChatContext } from "@/components/chat-context";

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
  const { setChatLoading, refreshChats } = useChatContext();
  const [isNewChat, setIsNewChat] = useState(initialMessages?.length === 0);

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

  // Clear loading state when AI starts responding or finishes
  useEffect(() => {
    if (status === "streaming" || status === "ready" || status === "error") {
      setChatLoading(id, false);
    }

    // Only refresh the specific chat when the AI response is complete AND this is a new chat
    // This prevents flickering when navigating to existing chats
    if (status === "streaming" && isNewChat) {
      // Add a small delay to ensure the title generation has completed
      refreshChats();
      setIsNewChat(false); // Prevent multiple refreshes
    }
  }, [status, id, setChatLoading, refreshChats, isNewChat]);

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
