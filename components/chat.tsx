"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useChat as useChatContext } from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { image_models } from "@/lib/ai/models";
import type { Session } from "@/lib/auth";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { Messages } from "./chat-messages";

interface ChatProps {
  id: string;
  session: Session | null;
  initialChatModel: string;
  initialMessages: ChatMessage[];
}

export function Chat({
  id,
  initialChatModel,
  initialMessages,
  session,
}: ChatProps) {
  const [isAuthenticated] = useState(session ? true : false);
  const {
    setChatLoading,
    refreshChats,
    getChatInputState,
    setChatInputState,
    clearChatInputState,
  } = useChatContext();
  const [isNewChat, setIsNewChat] = useState(initialMessages?.length === 0);

  // Get persisted input state for this chat
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [useSearch, setUseSearch] = useState(false);

  // Restore input state when chat ID changes
  useEffect(() => {
    const persistedState = getChatInputState(id);
    setInput(persistedState.input);
    setAttachments(persistedState.attachments);
    setUseSearch(persistedState.useSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { messages, sendMessage, status, setMessages, stop } =
    useChat<ChatMessage>({
      id,
      messages: initialMessages,
      generateId: generateUUID,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        fetch: fetchWithErrorHandlers,
        prepareSendMessagesRequest({ messages, id, body }) {
          return {
            body: {
              id,
              message: messages.at(-1),
              selectedChatModel: initialChatModel,
              ...body,
            },
          };
        },
      }),
      onError: (err) => {
        toast.error("Error", {
          description: err.message,
        });
      },
    });

  // Persist input state whenever it changes
  useEffect(() => {
    setChatInputState(id, { input, attachments, useSearch });
  }, [id, input, attachments, useSearch, setChatInputState]);

  // Track previous status to detect completion
  const prevStatusRef = useRef(status);

  // Check if current model is an image model
  const isImageModel = image_models.some((m) => m.id === initialChatModel);

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

    // For image models, fetch fresh messages when generation completes
    // This is needed because createUIMessageStream doesn't track manually appended messages
    if (
      isImageModel &&
      (prevStatusRef.current === "submitted" ||
        prevStatusRef.current === "streaming") &&
      status === "ready"
    ) {
      // Fetch fresh messages from the server
      fetch(`/api/chats/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch((err) => {
          console.error(
            "Failed to fetch messages after image generation:",
            err,
          );
        });
    }

    prevStatusRef.current = status;
  }, [
    status,
    id,
    setChatLoading,
    refreshChats,
    isNewChat,
    isImageModel,
    setMessages,
  ]);

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
            <Messages
              status={status}
              messages={messages}
              setMessages={setMessages}
              chatId={id}
              selectedChatModel={initialChatModel}
            />

            <div className="max-w-3xl mx-auto space-y-4 w-full">
              <p className="text-center text-sm text-gray-400">shaaddev</p>
              <ChatInput
                input={input}
                setInput={setInput}
                sendMessage={sendMessage}
                status={status}
                chatId={id}
                stop={stop}
                initialChatModel={initialChatModel}
                isAuthenticated={isAuthenticated}
                attachments={attachments}
                setAttachments={setAttachments}
                setMessages={setMessages}
                useSearch={useSearch}
                setUseSearch={setUseSearch}
                clearChatInputState={clearChatInputState}
              />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
