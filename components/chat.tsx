"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isFileUIPart } from "ai";
import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useChat as useChatContext,
  useChatDraft,
  useChatTitle,
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
import { openCommandPalette } from "@/lib/command-palette";
import { ChatSDKError } from "@/lib/errors";
import { extractSources, type Source } from "@/lib/sources";
import type { ChatMessage, DocumentDraft } from "@/lib/types";
import {
  cn,
  fetchWithErrorHandlers,
  generateUUID,
  hasVisibleContent,
} from "@/lib/utils";
import { ChatInput } from "./chat-input";
import { Messages } from "./chat-messages";
import { AttachmentDropZone } from "./drop-overlay";
import { EmptyGreeting, SuggestionChips } from "./empty-chat-state";

const DRAFT_SAVE_DELAY_MS = 200;
const DOCUMENT_TITLE_MAX_LENGTH = 80;
const MemoizedChatInput = memo(ChatInput);
const LazyDocumentSheet = dynamic(
  () => import("./document-sheet").then((module) => module.DocumentSheet),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-y-0 right-0 z-50 block w-full max-w-xl bg-card p-6">
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

function ChatHeaderComponent({
  chatId,
  savedTitle,
}: {
  chatId: string;
  savedTitle: string | undefined;
}) {
  const title = useChatTitle(chatId) ?? savedTitle ?? "New chat";
  return (
    <header className="flex h-[50px] shrink-0 items-center gap-1.5 px-2 md:h-12 md:px-3.5">
      <SidebarTrigger className="size-9 rounded-[10px] text-muted-foreground" />
      <h1 className="min-w-0 truncate font-medium text-sm">{title}</h1>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Search chats and actions"
        className="ml-auto size-9 rounded-[10px] text-muted-foreground"
        onClick={openCommandPalette}
        size="icon"
        variant="ghost"
      >
        <Search aria-hidden className="size-4" />
      </Button>
    </header>
  );
}

const ChatHeader = memo(ChatHeaderComponent);

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
  initialTitle?: string;
  session: Session | null;
}

export function Chat({
  id,
  initialChatModel,
  initialMessages,
  session,
  initialSystemPrompt,
  initialTitle,
}: ChatProps) {
  const [isAuthenticated] = useState(!!session);
  const { setChatLoading, refreshChats } = useChatContext();
  const { getChatInputState, setChatInputState, clearChatInputState } =
    useChatDraft();
  const [selectedModelId, setSelectedModelId] = useState<ChatModelId>(
    () => findChatModel(initialChatModel)?.id ?? DEFAULT_CHAT_MODEL
  );

  const [input, setInput] = useState("");
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

  const [sourcesMessageId, setSourcesMessageId] = useState<string | null>(null);
  const toggleSources = useCallback((messageId: string) => {
    setSourcesMessageId((current) =>
      current === messageId ? null : messageId
    );
  }, []);
  const closeSources = useCallback(() => setSourcesMessageId(null), []);

  const openDocumentBuilder = useCallback(() => {
    setIsDocumentSheetOpen(true);
    setSourcesMessageId(null);
  }, []);
  const handleSuggestionClick = useCallback((text: string) => {
    setInput(text);
  }, []);

  useEffect(() => {
    const persistedState = getChatInputState(id);
    setInput(persistedState.input);
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
        prepareSendMessagesRequest: ({
          messages: outgoing,
          id: chatId,
          trigger,
          messageId,
        }) => ({
          body: {
            id: chatId,
            message: outgoing.at(-1),
            trigger,
            messageId,
            ...requestSettingsRef.current,
          },
        }),
      })
  );

  // The server saves a regenerated reply only when it has visible content, and
  // otherwise keeps the old one, so the thread puts the old one back to match.
  const replacedReplyRef = useRef<ChatMessage | undefined>(undefined);

  const {
    error,
    messages,
    regenerate,
    sendMessage,
    status,
    setMessages,
    stop,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    generateId: generateUUID,
    transport,
    throttle: 50,
    onFinish: ({ message, isAbort, isError }) => {
      const replacedReply = replacedReplyRef.current;
      replacedReplyRef.current = undefined;
      if (!(isAbort || isError) && message.parts.some(isFileUIPart)) {
        toast.success("Image generated");
      }
      if (replacedReply && !hasVisibleContent(message)) {
        setMessages((current) => [
          ...current.filter(({ id: messageId }) => messageId !== message.id),
          replacedReply,
        ]);
        if (!(isAbort || isError)) {
          toast("Kept the previous reply", {
            description: "The regenerated reply came back empty.",
          });
        }
      }
      refreshChats();
    },
    onError: (err) => {
      toast.error("Error", {
        description:
          err instanceof ChatSDKError && typeof err.cause === "string"
            ? err.cause
            : err.message,
      });
    },
  });
  const { latestAssistantMessage, latestUserMessage } =
    getLatestConversationMessages(messages);

  const replyToRegenerate = messages.at(-1);
  const handleRegenerate = useCallback(async () => {
    replacedReplyRef.current =
      replyToRegenerate?.role === "assistant" &&
      hasVisibleContent(replyToRegenerate)
        ? replyToRegenerate
        : undefined;
    setChatLoading(id, true);
    await regenerate();
  }, [id, regenerate, replyToRegenerate, setChatLoading]);

  const handleEditMessage = useCallback(
    async (message: ChatMessage, text: string) => {
      setChatLoading(id, true);
      await sendMessage({
        text,
        files: message.parts.filter(isFileUIPart),
        messageId: message.id,
      });
    },
    [id, sendMessage, setChatLoading]
  );

  const latestAssistantId = latestAssistantMessage?.id;

  // A new latest reply, from a send, a regenerate, or an edit, closes the
  // panel so it never lingers over a reply it doesn't describe.
  const [sourcesLatestId, setSourcesLatestId] = useState(latestAssistantId);
  if (sourcesLatestId !== latestAssistantId) {
    setSourcesLatestId(latestAssistantId);
    setSourcesMessageId(null);
  }

  const panelSources = useStableSources(
    sourcesMessageId === null
      ? undefined
      : messages.find(({ id: messageId }) => messageId === sourcesMessageId)
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setChatInputState(id, {
        input,
        useSearch,
        autoDocumentGeneration,
      });
    }, DRAFT_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [useSearch, autoDocumentGeneration, id, input, setChatInputState]);

  const isImageModel = getChatModel(selectedModelId).kind === "image";

  useEffect(() => {
    if (status === "streaming" || status === "ready" || status === "error") {
      setChatLoading(id, false);
    }
  }, [status, id, setChatLoading]);

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

  const isSourcesPanelOpen = !isDocumentSheetOpen && panelSources.length > 0;
  const isRightPanelOpen = isDocumentSheetOpen || isSourcesPanelOpen;
  // The server answers with an HTTP error only before it saves a turn, and
  // fetchWithErrorHandlers turns every HTTP error into a ChatSDKError, so
  // nothing to regenerate was saved.
  const turnWasRefused = status === "error" && error instanceof ChatSDKError;
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 w-full">
      <AttachmentDropZone
        chatId={id}
        className="flex w-full min-w-0 flex-1 flex-col"
        isAuthenticated={isAuthenticated}
      >
        <ChatHeader chatId={id} savedTitle={initialTitle} />

        <div className="relative flex min-h-0 w-full flex-1 flex-col">
          <Messages
            chatId={id}
            documentDraft={documentDraft}
            isImageModelSelected={isImageModel}
            isNarrow={isRightPanelOpen}
            messages={messages}
            onEditMessage={handleEditMessage}
            onOpenDocumentBuilder={openDocumentBuilder}
            onRegenerate={handleRegenerate}
            onToggleSources={toggleSources}
            selectedModelId={selectedModelId}
            sourcesMessageId={isSourcesPanelOpen ? sourcesMessageId : null}
            status={status}
            turnWasRefused={turnWasRefused}
          />

          <div
            className={cn(
              "mx-auto w-full px-2.5 pb-2.5 md:px-6 md:pb-[18px]",
              isRightPanelOpen ? "md:max-w-[720px]" : "md:max-w-[768px]",
              isEmpty &&
                "absolute inset-0 flex flex-col justify-center gap-[22px] pb-[calc(4vh+34px)] md:pb-[calc(10vh+42px)]"
            )}
            data-composer=""
          >
            {isEmpty ? <EmptyGreeting name={session?.user.name} /> : null}
            <MemoizedChatInput
              autoDocumentGeneration={autoDocumentGeneration}
              chatId={id}
              clearChatInputState={clearChatInputState}
              customSystemPrompt={customSystemPrompt}
              input={input}
              isAuthenticated={isAuthenticated}
              onSelectModel={handleSelectModel}
              selectedModelId={selectedModelId}
              sendMessage={sendMessage}
              setAutoDocumentGeneration={setAutoDocumentGeneration}
              setCustomSystemPrompt={setCustomSystemPrompt}
              setInput={setInput}
              setMessages={setMessages}
              setUseSearch={setUseSearch}
              status={status}
              stop={stop}
              useSearch={useSearch}
            />
            {isEmpty ? (
              <SuggestionChips onSuggestionClick={handleSuggestionClick} />
            ) : null}
          </div>
        </div>
      </AttachmentDropZone>
      {isDocumentSheetOpen ? (
        <LazyDocumentSheet
          initialMarkdown={documentDraft?.markdown}
          initialTitle={documentDraft?.title}
          onOpenChange={setIsDocumentSheetOpen}
          open={isDocumentSheetOpen}
          suggestedFormat={documentDraft?.format ?? "docx"}
        />
      ) : null}
      {isSourcesPanelOpen ? (
        <LazySourcesPanel
          key={sourcesMessageId}
          onClose={closeSources}
          sources={panelSources}
        />
      ) : null}
    </div>
  );
}
