"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PanelLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useChat as useChatContext,
  useChatDraft,
} from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { image_models } from "@/lib/ai/models";
import type { Session } from "@/lib/auth";
import type { ExportFormat } from "@/lib/document-export";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { Messages } from "./chat-messages";

const DRAFT_SAVE_DELAY_MS = 200;
const LazyDocumentSheet = dynamic(
  () => import("./document-sheet").then((module) => module.DocumentSheet),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-y-0 right-0 z-50 block w-full max-w-xl border-border border-l bg-background/95 p-6 backdrop-blur">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
          <div className="h-32 rounded-lg bg-muted" />
          <div className="h-48 rounded-lg bg-muted" />
        </div>
      </div>
    ),
  }
);

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
  if (!message) {
    return "";
  }
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function getLatestConversationMessages(messages: ChatMessage[]) {
  let latestAssistantMessage: ChatMessage | undefined;
  let latestUserMessage: ChatMessage | undefined;

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];

    if (!latestAssistantMessage && message.role === "assistant") {
      latestAssistantMessage = message;
    }

    if (!latestUserMessage && message.role === "user") {
      latestUserMessage = message;
    }

    if (latestAssistantMessage && latestUserMessage) {
      break;
    }
  }

  return { latestAssistantMessage, latestUserMessage };
}

interface ChatProps {
  id: string;
  initialChatModel: string;
  initialMessages: ChatMessage[];
  initialSystemPrompt?: string;
  session: Session | null;
}

export function Chat({
  id,
  initialChatModel,
  initialMessages,
  session,
  initialSystemPrompt,
}: ChatProps) {
  const [isAuthenticated] = useState(!!session);
  const { setChatLoading, refreshChats } = useChatContext();
  const { getChatInputState, setChatInputState, clearChatInputState } =
    useChatDraft();
  const [isNewChat, setIsNewChat] = useState(initialMessages?.length === 0);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [useSearch, setUseSearch] = useState(false);
  const [autoDocumentGeneration, setAutoDocumentGeneration] = useState(false);
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
  const openDocumentBuilder = useCallback(() => {
    setIsDocumentSheetOpen(true);
  }, []);
  const handleSuggestionClick = useCallback((text: string) => {
    setInput(text);
  }, []);

  useEffect(() => {
    const persistedState = getChatInputState(id);
    setInput(persistedState.input);
    setAttachments(persistedState.attachments);
    setUseSearch(persistedState.useSearch);
    setAutoDocumentGeneration(persistedState.autoDocumentGeneration);
  }, [getChatInputState, id]);

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
  const { latestAssistantMessage, latestUserMessage } =
    getLatestConversationMessages(messages);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setChatInputState(id, {
        input,
        attachments,
        useSearch,
        autoDocumentGeneration,
      });
    }, DRAFT_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    attachments,
    useSearch,
    autoDocumentGeneration,
    id,
    input,
    setChatInputState,
  ]);

  const prevStatusRef = useRef(status);
  const isImageModel = image_models.some((m) => m.id === initialChatModel);

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
      toast.success("Image generated!", {
        description: "Your image has been created successfully.",
      });
    }

    prevStatusRef.current = status;
  }, [status, id, setChatLoading, refreshChats, isNewChat, isImageModel]);

  useEffect(() => {
    const latestAssistant = latestAssistantMessage;

    if (!latestAssistant) {
      return;
    }

    const metadata =
      typeof latestAssistant.metadata === "object" && latestAssistant.metadata
        ? (latestAssistant.metadata as Record<string, unknown>)
        : null;
    const userText = extractMessageText(latestUserMessage);
    const assistantText = extractMessageText(latestAssistant);

    if (!assistantText) {
      return;
    }

    const isAlreadyTracked = documentSourceMessageId === latestAssistant.id;

    if (!isAlreadyTracked) {
      if (lastHandledAssistantIdRef.current === latestAssistant.id) {
        return;
      }

      const metadataCandidate = metadata?.documentCandidate === true;
      const fallbackCandidate =
        autoDocumentGeneration &&
        hasDocumentIntent(userText) &&
        !!assistantText;
      if (!metadataCandidate && !fallbackCandidate) {
        return;
      }

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
  }, [
    autoDocumentGeneration,
    documentSourceMessageId,
    latestAssistantMessage,
    latestUserMessage,
  ]);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background text-foreground">
        <ChatHistory session={session} />

        <div className="flex w-full min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 px-4">
            <SidebarTrigger className="rounded-lg">
              <Button className="size-8" size="icon" variant="ghost">
                <PanelLeft className="size-4" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </SidebarTrigger>
          </header>

          <div className="flex w-full flex-1 flex-col overflow-hidden">
            <Messages
              chatId={id}
              documentDraftFormat={documentFormat}
              documentDraftMarkdown={documentMarkdown}
              documentDraftTitle={documentTitle}
              documentSourceMessageId={documentSourceMessageId}
              isDocumentSheetOpen={isDocumentSheetOpen}
              messages={messages}
              onOpenDocumentBuilder={openDocumentBuilder}
              onSuggestionClick={handleSuggestionClick}
              selectedChatModel={initialChatModel}
              status={status}
            />

            <div
              className={`mx-auto w-full px-4 pt-2 pb-5 ${
                isDocumentSheetOpen ? "max-w-2xl" : "max-w-3xl"
              }`}
            >
              <ChatInput
                attachments={attachments}
                autoDocumentGeneration={autoDocumentGeneration}
                chatId={id}
                clearChatInputState={clearChatInputState}
                customSystemPrompt={customSystemPrompt}
                initialChatModel={initialChatModel}
                input={input}
                isAuthenticated={isAuthenticated}
                sendMessage={sendMessage}
                setAttachments={setAttachments}
                setAutoDocumentGeneration={setAutoDocumentGeneration}
                setCustomSystemPrompt={setCustomSystemPrompt}
                setInput={setInput}
                setMessages={setMessages}
                setUseSearch={setUseSearch}
                status={status}
                stop={stop}
                useSearch={useSearch}
              />
              <p className="mt-2 select-none text-center text-[11px] text-muted-foreground/50">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
        {isDocumentSheetOpen ? (
          <LazyDocumentSheet
            initialMarkdown={documentMarkdown}
            initialTitle={documentTitle}
            onOpenChange={setIsDocumentSheetOpen}
            open={isDocumentSheetOpen}
            suggestedFormat={documentFormat}
          />
        ) : null}
      </div>
    </SidebarProvider>
  );
}
