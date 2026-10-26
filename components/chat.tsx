"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PanelLeft } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useChat as useChatContext,
  useChatDraft,
} from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  type ChatModelId,
  DEFAULT_CHAT_MODEL,
  findChatModel,
  getChatModel,
} from "@/lib/ai/models";
import type { Session } from "@/lib/auth";
import { extractSources, type Source } from "@/lib/sources";
import type { Attachment, ChatMessage, DocumentDraft } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { ChatInput } from "./chat-input";
import { Messages } from "./chat-messages";

const DRAFT_SAVE_DELAY_MS = 200;
const DOCUMENT_TITLE_MAX_LENGTH = 80;
const MemoizedChatInput = memo(ChatInput);
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

const LazySourcesPanel = memo(
  dynamic(
    () => import("./sources-panel").then((module) => module.SourcesPanel),
    {
      ssr: false,
    }
  )
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

  for (let index = messages.length - 1; index >= 0; index -= 1) {
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

function haveSameSources(current: Source[], next: Source[]) {
  return (
    current.length === next.length &&
    current.every(
      (source, index) =>
        source.url === next[index].url && source.title === next[index].title
    )
  );
}

function deriveDocumentDraft(
  messages: ChatMessage[],
  messageId: string | null
): DocumentDraft | null {
  const index = messages.findIndex((candidate) => candidate.id === messageId);
  if (!messageId || index === -1) {
    return null;
  }
  const source = messages[index];
  const userText = extractMessageText(
    messages.findLast(
      (candidate, candidateIndex) =>
        candidateIndex < index && candidate.role === "user"
    )
  );
  const isPdf =
    source.metadata?.suggestedFormat === "pdf" ||
    userText.toLowerCase().includes("pdf");
  return {
    format: isPdf ? "pdf" : "docx",
    markdown: extractMessageText(source),
    messageId,
    title: userText.slice(0, DOCUMENT_TITLE_MAX_LENGTH) || "chat-document",
  };
}

function useStableSources(message: ChatMessage | undefined): Source[] {
  const next = useMemo(() => extractSources(message), [message]);
  const [sources, setSources] = useState(next);
  if (!haveSameSources(sources, next)) {
    setSources(next);
  }
  return sources;
}

function seedChatModelCookie(modelId: ChatModelId) {
  if (!("cookieStore" in window)) {
    return;
  }
  window.cookieStore.set("chat-model", modelId).catch(() => undefined);
}

interface ChatRequestSettings {
  autoDocumentGeneration: boolean;
  customSystemPrompt: string | undefined;
  selectedChatModel: ChatModelId;
  useSearch: boolean;
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
  const [selectedModelId, setSelectedModelId] = useState<ChatModelId>(
    () => findChatModel(initialChatModel)?.id ?? DEFAULT_CHAT_MODEL
  );

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // Web search defaults ON. The actual user-preferred default is hydrated
  // from localStorage on mount via `getChatInputState` below.
  const [useSearch, setUseSearch] = useState(true);
  const [autoDocumentGeneration, setAutoDocumentGeneration] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState<
    string | undefined
  >(initialSystemPrompt);
  const [isDocumentSheetOpen, setIsDocumentSheetOpen] = useState(false);
  const [documentSourceMessageId, setDocumentSourceMessageId] = useState<
    string | null
  >(null);

  // Sources panel state — auto-opens when sources arrive for the latest
  // assistant response, but stays closed if the user dismissed it for that
  // specific response.
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [sourcesPanelDismissedFor, setSourcesPanelDismissedFor] = useState<
    Set<string>
  >(() => new Set());

  const openDocumentBuilder = useCallback(() => {
    setIsDocumentSheetOpen(true);
    // Document and sources panels share the right slot — close sources.
    setIsSourcesPanelOpen(false);
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

  const handleSelectModel = useCallback((modelId: ChatModelId) => {
    setSelectedModelId(modelId);
    seedChatModelCookie(modelId);
  }, []);

  const requestSettings: ChatRequestSettings = {
    autoDocumentGeneration,
    customSystemPrompt,
    selectedChatModel: selectedModelId,
    useSearch,
  };
  const requestSettingsRef = useRef(requestSettings);
  useEffect(() => {
    requestSettingsRef.current = requestSettings;
  });

  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        fetch: fetchWithErrorHandlers,
        prepareSendMessagesRequest: ({ messages: outgoing, id: chatId }) => ({
          body: {
            id: chatId,
            message: outgoing.at(-1),
            ...requestSettingsRef.current,
          },
        }),
      })
  );

  const { messages, sendMessage, status, setMessages, stop } =
    useChat<ChatMessage>({
      id,
      messages: initialMessages,
      generateId: generateUUID,
      transport,
      throttle: 50,
      onFinish: () => refreshChats(),
      onError: (err) => {
        toast.error("Error", {
          description: err.message,
        });
      },
    });
  const { latestAssistantMessage, latestUserMessage } =
    getLatestConversationMessages(messages);

  const latestAssistantId = latestAssistantMessage?.id;

  const latestSources = useStableSources(latestAssistantMessage);

  // Auto-open the sources panel when fresh sources arrive for the latest
  // assistant message and the user hasn't dismissed it. Don't fight an
  // already-open document sheet: sources only opens if doc sheet is closed.
  useEffect(() => {
    if (!latestAssistantId) {
      return;
    }
    if (latestSources.length === 0) {
      return;
    }
    if (sourcesPanelDismissedFor.has(latestAssistantId)) {
      return;
    }
    if (isDocumentSheetOpen) {
      return;
    }
    setIsSourcesPanelOpen(true);
  }, [
    isDocumentSheetOpen,
    latestAssistantId,
    latestSources.length,
    sourcesPanelDismissedFor,
  ]);

  const handleSourcesPanelOpenChange = useCallback(
    (open: boolean) => {
      setIsSourcesPanelOpen(open);
      if (!open && latestAssistantId) {
        setSourcesPanelDismissedFor((prev) => {
          const next = new Set(prev);
          next.add(latestAssistantId);
          return next;
        });
      }
    },
    [latestAssistantId]
  );

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
  const selectedModel = getChatModel(selectedModelId);
  const isImageModel = selectedModel.kind === "image";

  useEffect(() => {
    if (status === "streaming" || status === "ready" || status === "error") {
      setChatLoading(id, false);
    }

    if (
      isImageModel &&
      (prevStatusRef.current === "submitted" ||
        prevStatusRef.current === "streaming") &&
      status === "ready"
    ) {
      toast.success("Image generated");
    }

    prevStatusRef.current = status;
  }, [status, id, setChatLoading, isImageModel]);

  const latestAssistantIsDocument =
    latestAssistantMessage !== undefined &&
    extractMessageText(latestAssistantMessage).length > 0 &&
    (latestAssistantMessage.metadata?.documentCandidate === true ||
      (autoDocumentGeneration &&
        hasDocumentIntent(extractMessageText(latestUserMessage))));

  useEffect(() => {
    if (latestAssistantIsDocument && latestAssistantId) {
      setDocumentSourceMessageId(latestAssistantId);
    }
  }, [latestAssistantIsDocument, latestAssistantId]);

  const documentDraft = useMemo(
    () => deriveDocumentDraft(messages, documentSourceMessageId),
    [messages, documentSourceMessageId]
  );

  const isRightPanelOpen = isDocumentSheetOpen || isSourcesPanelOpen;
  const messageWidthClass = isRightPanelOpen ? "max-w-2xl" : "max-w-3xl";

  return (
    <div className="flex h-dvh w-full bg-background text-foreground">
      <div className="flex w-full min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4">
          <SidebarTrigger className="rounded-lg">
            <Button className="size-8" size="icon" variant="ghost">
              <PanelLeft className="size-4" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </SidebarTrigger>
          <span className="select-none font-serif text-[15px] text-foreground/75 italic tracking-tight">
            chat<span className="text-accent">.</span>
          </span>
        </header>

        <div className="flex w-full flex-1 flex-col overflow-hidden">
          <Messages
            chatId={id}
            documentDraft={documentDraft}
            isImageModelSelected={isImageModel}
            isNarrow={isRightPanelOpen}
            messages={messages}
            onOpenDocumentBuilder={openDocumentBuilder}
            onSuggestionClick={handleSuggestionClick}
            status={status}
          />

          <div className={`mx-auto w-full px-4 pt-2 pb-5 ${messageWidthClass}`}>
            <MemoizedChatInput
              attachments={attachments}
              autoDocumentGeneration={autoDocumentGeneration}
              chatId={id}
              clearChatInputState={clearChatInputState}
              customSystemPrompt={customSystemPrompt}
              input={input}
              isAuthenticated={isAuthenticated}
              onSelectModel={handleSelectModel}
              selectedModelId={selectedModelId}
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
            <p className="mt-2 select-none text-center text-muted-foreground text-xs">
              AI can be wrong. Verify important info.
            </p>
          </div>
        </div>
      </div>
      {isDocumentSheetOpen ? (
        <LazyDocumentSheet
          initialMarkdown={documentDraft?.markdown}
          initialTitle={documentDraft?.title}
          onOpenChange={setIsDocumentSheetOpen}
          open={isDocumentSheetOpen}
          suggestedFormat={documentDraft?.format ?? "docx"}
        />
      ) : null}
      {!isDocumentSheetOpen && isSourcesPanelOpen ? (
        <LazySourcesPanel
          onOpenChange={handleSourcesPanelOpenChange}
          open={isSourcesPanelOpen}
          sources={latestSources}
        />
      ) : null}
    </div>
  );
}
