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
import {
  adoptThread,
  joinDraftText,
  requestSettle,
  type SettledThread,
  turnFailure,
  turnOutcome,
} from "@/lib/chat-turn";
import { openCommandPalette } from "@/lib/command-palette";
import { ChatSDKError } from "@/lib/errors";
import { extractSources, type Source } from "@/lib/sources";
import type { ChatMessage, DocumentDraft } from "@/lib/types";
import { readiness, type SentFile, sentFiles } from "@/lib/uploadthing/tray";
import {
  cn,
  fetchWithErrorHandlers,
  generateUUID,
  hasVisibleContent,
} from "@/lib/utils";
import { getAttachmentTray } from "./attachment-tray";
import { ChatInput } from "./chat-input";
import { Messages, type SettleStatus, type UnsavedEdit } from "./chat-messages";
import { AttachmentDropZone } from "./drop-overlay";
import { EmptyGreeting, SuggestionChips } from "./empty-chat-state";

const DRAFT_SAVE_DELAY_MS = 200;
const DOCUMENT_TITLE_MAX_LENGTH = 80;
const CHAT_TITLE_MAX_LENGTH = 80;
const STOP_WAIT_MS = 10_000;

type TurnRequest =
  | { kind: "append"; files: SentFile[]; text: string }
  | { kind: "edit"; messageId: string; text: string }
  | { kind: "regenerate"; replacedReply: ChatMessage | undefined };

interface Turn {
  id: string;
  request: TurnRequest;
}

interface PreparedTurn {
  request: TurnRequest;
  send: () => Promise<void>;
}

type SettleResult = "settled" | "handed-back" | "failed";

interface Ended {
  expectReply: boolean;
  shown: ChatMessage[];
  turn: Turn;
}

type PendingTurn =
  | { phase: "running"; turn: Turn; error?: unknown }
  | ({ phase: "settling"; result: Promise<SettleResult> } & Ended)
  | ({ phase: "unsettled" } & Ended);

const TURN_NOT_SAVED: Record<
  TurnRequest["kind"],
  { title: string; description: string }
> = {
  append: {
    title: "Your message wasn't sent",
    description: "It's back in the composer.",
  },
  edit: {
    title: "Your edit wasn't saved",
    description: "Its text is back so you can try again.",
  },
  regenerate: {
    title: "The reply wasn't regenerated",
    description: "Try regenerating it again.",
  },
};

const chatTitle = ({ request }: Turn) =>
  (request.kind === "append"
    ? request.text
        .replaceAll("\u0000", "")
        .trim()
        .slice(0, CHAT_TITLE_MAX_LENGTH)
    : "") || "New chat";

// A Stop before the response starts waits for it, because the server answers
// only after it saves or refuses the turn. A settle sent sooner could reach the
// server before that save, and a new chat has no row yet for it to claim.
async function fetchTurn(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  onAccepted: () => void
): Promise<Response> {
  const stopped = init?.signal;
  const request = new AbortController();
  let accepted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (accepted) {
      request.abort();
    } else {
      timer ??= setTimeout(() => request.abort(), STOP_WAIT_MS);
    }
  };
  if (stopped?.aborted) {
    stop();
  }
  stopped?.addEventListener("abort", stop, { once: true });
  try {
    const response = await fetchWithErrorHandlers(input, {
      ...init,
      signal: request.signal,
    });
    accepted = true;
    onAccepted();
    if (stopped?.aborted) {
      request.abort();
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

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
  messageId: string | null,
  isChatStreaming: boolean
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
    isStreaming: isChatStreaming && index === messages.length - 1,
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
  const { addOptimisticChat, setChatLoading, refreshChats } = useChatContext();
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

  const savedThreadRef = useRef(initialMessages);
  const isNewChatRef = useRef(initialMessages.length === 0);
  const pendingRef = useRef<PendingTurn | undefined>(undefined);
  const [settleStatus, setSettleStatus] = useState<SettleStatus | null>(null);
  const [unsavedEdit, setUnsavedEdit] = useState<UnsavedEdit | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setPending = useCallback((pending: PendingTurn | undefined) => {
    pendingRef.current = pending;
    setSettleStatus(
      pending?.phase === "settling" || pending?.phase === "unsettled"
        ? pending.phase
        : null
    );
  }, []);

  const showChatSaved = useCallback(
    (turn: Turn) => {
      if (!(isNewChatRef.current && mountedRef.current)) {
        return;
      }
      isNewChatRef.current = false;
      window.history.replaceState({}, "", `/chat/${id}`);
      addOptimisticChat({ id, title: chatTitle(turn) });
    },
    [addOptimisticChat, id]
  );

  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        fetch: (url, init) =>
          fetchTurn(url, init, () => {
            const pending = pendingRef.current;
            if (pending) {
              showChatSaved(pending.turn);
            }
          }),
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
            turnId: pendingRef.current?.turn.id,
            ...requestSettingsRef.current,
          },
        }),
      })
  );

  const { messages, regenerate, sendMessage, status, setMessages, stop } =
    useChat<ChatMessage>({
      id,
      messages: initialMessages,
      generateId: generateUUID,
      transport,
      throttle: 50,
      onFinish: ({ message, messages: thread, isAbort, isError }) => {
        const pending = pendingRef.current;
        if (pending?.phase !== "running") {
          refreshChats();
          return;
        }
        // Leaving a chat mid-turn skips the settle, so the reply the server is
        // still saving lands.
        if (!mountedRef.current) {
          pendingRef.current = undefined;
          refreshChats();
          return;
        }
        const { turn, error } = pending;
        const outcome = turnOutcome({ isAbort, isError, error });
        if (outcome === "finished") {
          finishTurn(turn, message, thread);
        } else if (outcome === "refused") {
          restoreInput(turn, showSaved(turn, thread, savedThreadRef.current));
        } else {
          settle({
            turn,
            shown: thread,
            expectReply: hasVisibleContent(message),
          });
        }
      },
      onError: (err) => {
        const pending = pendingRef.current;
        if (pending?.phase === "running") {
          setPending({ ...pending, error: err });
        }
        if (turnFailure(err) === "lost") {
          return;
        }
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

  const showChatMissing = useCallback(() => {
    isNewChatRef.current = true;
    if (mountedRef.current && window.location.pathname === `/chat/${id}`) {
      window.history.replaceState({}, "", "/");
    }
  }, [id]);

  const showSaved = useCallback(
    (turn: Turn, shown: ChatMessage[], saved: ChatMessage[]) => {
      const thread = adoptThread(shown, saved);
      savedThreadRef.current = thread;
      setMessages(thread);
      setPending(undefined);
      if (thread.length > 0) {
        showChatSaved(turn);
      } else {
        showChatMissing();
      }
      refreshChats();
      return thread;
    },
    [refreshChats, setMessages, setPending, showChatMissing, showChatSaved]
  );

  const restoreInput = useCallback(
    ({ request }: Turn, thread: ChatMessage[]) => {
      if (request.kind === "regenerate") {
        return false;
      }
      const isEditShown =
        request.kind === "edit" &&
        thread.some(({ id: messageId }) => messageId === request.messageId);
      if (isEditShown && mountedRef.current) {
        setUnsavedEdit({ messageId: request.messageId, text: request.text });
        return true;
      }
      if (mountedRef.current) {
        setInput((typed) => joinDraftText(request.text, typed));
      } else {
        // The composer loads this draft when the chat opens again.
        setChatInputState(id, {
          input: joinDraftText(request.text, getChatInputState(id).input),
        });
      }
      if (request.kind === "append") {
        getAttachmentTray(id).restore(request.files);
      }
      return true;
    },
    [getChatInputState, id, setChatInputState]
  );

  const settle = useCallback(
    ({ expectReply, shown, turn }: Ended) => {
      const result = requestSettle(id, turn.id, expectReply).then(
        ({ messages: saved, turnSaved }: SettledThread): SettleResult => {
          const thread = showSaved(turn, shown, saved);
          if (turnSaved) {
            return "settled";
          }
          if (mountedRef.current) {
            const notice = TURN_NOT_SAVED[turn.request.kind];
            toast(notice.title, { description: notice.description });
          }
          return restoreInput(turn, thread) ? "handed-back" : "settled";
        },
        (): SettleResult => {
          setPending({ phase: "unsettled", expectReply, shown, turn });
          return "failed";
        }
      );
      setPending({ phase: "settling", expectReply, result, shown, turn });
      return result;
    },
    [id, restoreInput, setPending, showSaved]
  );

  const finishTurn = useCallback(
    (turn: Turn, reply: ChatMessage, thread: ChatMessage[]) => {
      if (reply.parts.some(isFileUIPart)) {
        toast.success("Image generated");
      }
      const { request } = turn;
      // The server keeps the old reply when a regenerated one comes back empty.
      const keptReply =
        request.kind === "regenerate" && !hasVisibleContent(reply)
          ? request.replacedReply
          : undefined;
      const saved = keptReply
        ? [
            ...thread.filter(({ id: messageId }) => messageId !== reply.id),
            keptReply,
          ]
        : thread;
      if (keptReply) {
        setMessages(saved);
        toast("Kept the previous reply", {
          description: "The regenerated reply came back empty.",
        });
      }
      savedThreadRef.current = saved;
      setPending(undefined);
      refreshChats();
    },
    [refreshChats, setMessages, setPending]
  );

  const startTurn = useCallback(
    async (prepare: () => PreparedTurn | undefined) => {
      const pending = pendingRef.current;
      if (pending?.phase === "running") {
        return;
      }
      if (pending) {
        const result = await (pending.phase === "settling"
          ? pending.result
          : settle(pending));
        if (result !== "settled" || pendingRef.current) {
          return;
        }
      }
      const prepared = prepare();
      if (!prepared) {
        return;
      }
      const turn: Turn = { id: generateUUID(), request: prepared.request };
      setPending({ phase: "running", turn });
      setChatLoading(id, true);
      prepared.send().catch(() => {
        if (pendingRef.current?.turn === turn) {
          setPending(undefined);
          setChatLoading(id, false);
        }
      });
    },
    [id, setChatLoading, setPending, settle]
  );

  const retrySettle = useCallback(() => {
    const pending = pendingRef.current;
    if (pending?.phase === "unsettled") {
      settle(pending);
    }
  }, [settle]);

  useEffect(() => {
    if (settleStatus !== "unsettled") {
      return;
    }
    window.addEventListener("online", retrySettle);
    return () => window.removeEventListener("online", retrySettle);
  }, [retrySettle, settleStatus]);

  // The attachments are read when the turn starts, which can be after a
  // settle the send waited on.
  const sendTurn = useCallback(
    (text: string) =>
      startTurn(() => {
        const tray = getAttachmentTray(id);
        const items = tray.getItems();
        const trayState = readiness(items);
        const files = sentFiles(items);
        if (
          trayState === "uploading" ||
          trayState === "failed" ||
          !(text || files.length > 0)
        ) {
          return;
        }
        return {
          request: { kind: "append", files, text },
          send: () => {
            clearChatInputState(id);
            tray.clearAfterSend();
            setInput("");
            return sendMessage({
              role: "user",
              parts: [
                ...files.map((file) => ({ type: "file" as const, ...file })),
                ...(text ? [{ type: "text" as const, text }] : []),
              ],
            });
          },
        };
      }),
    [clearChatInputState, id, sendMessage, startTurn]
  );

  const replyToRegenerate = messages.at(-1);
  const handleRegenerate = useCallback(() => {
    startTurn(() => ({
      request: {
        kind: "regenerate",
        replacedReply:
          replyToRegenerate?.role === "assistant" &&
          hasVisibleContent(replyToRegenerate)
            ? replyToRegenerate
            : undefined,
      },
      send: () => regenerate(),
    }));
  }, [regenerate, replyToRegenerate, startTurn]);

  const handleEditMessage = useCallback(
    (message: ChatMessage, text: string) => {
      startTurn(() => ({
        request: { kind: "edit", messageId: message.id, text },
        send: () =>
          sendMessage({
            text,
            files: message.parts.filter(isFileUIPart),
            messageId: message.id,
          }),
      }));
    },
    [sendMessage, startTurn]
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
    () =>
      deriveDocumentDraft(
        messages,
        documentSourceMessageId,
        status === "streaming"
      ),
    [messages, documentSourceMessageId, status]
  );

  const isSourcesPanelOpen = !isDocumentSheetOpen && panelSources.length > 0;
  const isRightPanelOpen = isDocumentSheetOpen || isSourcesPanelOpen;
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
            onRetrySettle={retrySettle}
            onToggleSources={toggleSources}
            selectedModelId={selectedModelId}
            settleStatus={settleStatus}
            sourcesMessageId={isSourcesPanelOpen ? sourcesMessageId : null}
            status={status}
            unsavedEdit={unsavedEdit}
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
              customSystemPrompt={customSystemPrompt}
              input={input}
              isAuthenticated={isAuthenticated}
              onSelectModel={handleSelectModel}
              selectedModelId={selectedModelId}
              sendTurn={sendTurn}
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
          isStreaming={documentDraft?.isStreaming ?? false}
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
