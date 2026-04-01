"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useChat as useChatContext } from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import type { ExportFormat } from "@/lib/document-export";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { image_models } from "@/lib/ai/models";
import type { Session } from "@/lib/auth";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { Messages } from "./chat-messages";
import { DocumentSheet } from "./document-sheet";

const DOC_HINTS = [
  "document",
  "doc",
  "docx",
  "pdf",
  "letter",
  "report",
  "invoice",
  "proposal",
  "summary",
  "contract",
  "resume",
  "cv",
  "minutes",
  "plan",
  "memo",
];

function hasDocumentIntent(text: string) {
  const normalized = text.toLowerCase();
  return DOC_HINTS.some((hint) => normalized.includes(hint));
}

function extractMessageText(message: ChatMessage | undefined) {
  if (!message) return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

interface ChatProps {
  id: string;
  session: Session | null;
  initialChatModel: string;
  initialMessages: ChatMessage[];
  initialSystemPrompt?: string;
}

export function Chat({
  id,
  initialChatModel,
  initialMessages,
  session,
  initialSystemPrompt,
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
  const [autoDocumentGeneration, setAutoDocumentGeneration] = useState(true);
  const [customSystemPrompt, setCustomSystemPrompt] = useState<
    string | undefined
  >(initialSystemPrompt);
  const [isDocumentSheetOpen, setIsDocumentSheetOpen] = useState(false);
  const [documentMarkdown, setDocumentMarkdown] = useState("");
  const [documentTitle, setDocumentTitle] = useState("chat-document");
  const [documentFormat, setDocumentFormat] = useState<ExportFormat>("docx");
  const [documentSourceMessageId, setDocumentSourceMessageId] = useState<
    string | null
  >(null);

  const lastHandledAssistantIdRef = useRef<string | null>(null);

  // Restore input state when chat ID changes
  useEffect(() => {
    const persistedState = getChatInputState(id);
    setInput(persistedState.input);
    setAttachments(persistedState.attachments);
    setUseSearch(persistedState.useSearch);
    setAutoDocumentGeneration(persistedState.autoDocumentGeneration);
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
              customSystemPrompt,
              autoDocumentGeneration,
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
    setChatInputState(id, {
      input,
      attachments,
      useSearch,
      autoDocumentGeneration,
    });
  }, [
    id,
    input,
    attachments,
    useSearch,
    autoDocumentGeneration,
    setChatInputState,
  ]);

  // Track previous status to detect completion
  const prevStatusRef = useRef(status);

  // Check if current model is an image model
  const isImageModel = image_models.some((m) => m.id === initialChatModel);

  // Clear loading state when AI starts responding or finishes
  useEffect(() => {
    if (status === "streaming" || status === "ready" || status === "error") {
      setChatLoading(id, false);
    }

    if (status === "streaming" && isNewChat) {
      refreshChats();
      setIsNewChat(false);
    }

    if (
      isImageModel &&
      (prevStatusRef.current === "submitted" ||
        prevStatusRef.current === "streaming") &&
      status === "ready"
    ) {
      fetch(`/api/chats/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
            toast.success("Image generated!", {
              description: "Your image has been created successfully.",
            });
          }
        })
        .catch((err) => {
          console.error(
            "Failed to fetch messages after image generation:",
            err,
          );
          toast.error("Failed to load image", {
            description: "Please refresh the page to see your generated image.",
          });
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

  useEffect(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (!latestAssistant) return;

    const metadata =
      typeof latestAssistant.metadata === "object" && latestAssistant.metadata
        ? (latestAssistant.metadata as Record<string, unknown>)
        : null;
    const latestUser = [...messages]
      .reverse()
      .find((message) => message.role === "user");
    const userText = extractMessageText(latestUser);
    const assistantText = extractMessageText(latestAssistant);

    if (!assistantText) return;

    const isAlreadyTracked = documentSourceMessageId === latestAssistant.id;

    if (!isAlreadyTracked) {
      if (lastHandledAssistantIdRef.current === latestAssistant.id) return;

      const metadataCandidate = metadata?.documentCandidate === true;
      const fallbackCandidate =
        autoDocumentGeneration &&
        hasDocumentIntent(userText) &&
        !!assistantText;
      if (!metadataCandidate && !fallbackCandidate) return;

      lastHandledAssistantIdRef.current = latestAssistant.id;
      setDocumentSourceMessageId(latestAssistant.id);

      const suggestedFormat = metadata?.suggestedFormat;
      const format: ExportFormat =
        suggestedFormat === "pdf" || userText.toLowerCase().includes("pdf")
          ? "pdf"
          : "docx";
      setDocumentTitle(userText.slice(0, 80) || "chat-document");
      setDocumentFormat(format);
    }

    if (
      isAlreadyTracked ||
      lastHandledAssistantIdRef.current === latestAssistant.id
    ) {
      setDocumentMarkdown(assistantText);
    }
  }, [messages, autoDocumentGeneration, documentSourceMessageId]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background text-foreground">
        <ChatHistory session={session} />

        <div className="flex flex-col flex-1 w-full">
          <header className="flex items-center p-4 gap-2">
            <SidebarTrigger className="rounded-xl">
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="size-5 inline-block" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </SidebarTrigger>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              chat
            </h1>
          </header>

          <div className="flex flex-col flex-1 w-full border-l border-t border-border rounded-tl-2xl overflow-hidden bg-background">
            <Messages
              status={status}
              messages={messages}
              setMessages={setMessages}
              chatId={id}
              selectedChatModel={initialChatModel}
              isDocumentSheetOpen={isDocumentSheetOpen}
              documentDraftMarkdown={documentMarkdown}
              documentDraftTitle={documentTitle}
              documentDraftFormat={documentFormat}
              documentSourceMessageId={documentSourceMessageId}
              onOpenDocumentBuilder={() => setIsDocumentSheetOpen(true)}
              onSuggestionClick={(text) => setInput(text)}
            />

            <div
              className={`mx-auto space-y-4 w-full px-4 pb-4 ${
                isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"
              }`}
            >
              <p className="text-center text-sm text-muted-foreground">
                shaaddev
              </p>
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
                autoDocumentGeneration={autoDocumentGeneration}
                setAutoDocumentGeneration={setAutoDocumentGeneration}
                clearChatInputState={clearChatInputState}
                customSystemPrompt={customSystemPrompt}
                setCustomSystemPrompt={setCustomSystemPrompt}
              />
            </div>
          </div>
        </div>
        <DocumentSheet
          open={isDocumentSheetOpen}
          onOpenChange={setIsDocumentSheetOpen}
          initialMarkdown={documentMarkdown}
          initialTitle={documentTitle}
          suggestedFormat={documentFormat}
        />
      </div>
    </SidebarProvider>
  );
}
