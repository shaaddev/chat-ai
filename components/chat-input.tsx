import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowUp, CircleStop, Globe, Settings2 } from "lucide-react";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useChat } from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { ChatModelId } from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LoginContent } from "./auth/login-content";
import { FileInput } from "./file-input";
import { ModelsPopover } from "./models-popover";
import { PreviewAttachment } from "./preview-attachment";

const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 200;

interface ChatInputProps {
  attachments: Attachment[];
  autoDocumentGeneration: boolean;
  chatId: string | undefined;
  clearChatInputState: (chatId: string) => void;
  customSystemPrompt?: string;
  input: string;
  isAuthenticated?: boolean;
  onSelectModel: (modelId: ChatModelId) => void;
  selectedModelId: ChatModelId;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setAutoDocumentGeneration: Dispatch<SetStateAction<boolean>>;
  setCustomSystemPrompt: Dispatch<SetStateAction<string | undefined>>;
  setInput: Dispatch<SetStateAction<string>>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  setUseSearch: Dispatch<SetStateAction<boolean>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  useSearch: boolean;
}

export function ChatInput({
  setInput,
  input,
  sendMessage,
  stop,
  status,
  chatId,
  onSelectModel,
  selectedModelId,
  isAuthenticated,
  attachments,
  setAttachments,
  setMessages,
  useSearch,
  setUseSearch,
  autoDocumentGeneration,
  setAutoDocumentGeneration,
  clearChatInputState,
  customSystemPrompt,
  setCustomSystemPrompt,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(
    `${MIN_TEXTAREA_HEIGHT}px`
  );
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSystemPromptDialog, setShowSystemPromptDialog] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState(
    customSystemPrompt ?? ""
  );
  const { addOptimisticChat, setChatLoading } = useChat();
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const submitForm = useCallback(() => {
    if (!chatId) {
      return;
    }

    window.history.replaceState({}, "", `/chat/${chatId}`);

    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }

    setChatLoading(chatId, true);

    addOptimisticChat({
      id: chatId,
      title: input.trim().slice(0, 80) || "New chat",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      sendMessage({
        role: "user",
        parts: [
          ...attachments.map((attachment) => ({
            type: "file" as const,
            name: attachment.name,
            mediaType: attachment.contentType,
            url: attachment.url,
          })),
          {
            type: "text",
            text: input,
          },
        ],
      });
    } catch (error) {
      setChatLoading(chatId, false);
      throw error;
    }

    clearChatInputState(chatId);
    setAttachments([]);
    setInput("");
    // Note: we intentionally do NOT reset useSearch — it persists across
    // submissions and is the user's global preference.
  }, [
    sendMessage,
    setInput,
    chatId,
    isAuthenticated,
    addOptimisticChat,
    setChatLoading,
    attachments,
    setAttachments,
    input,
    clearChatInputState,
  ]);

  const isBusy = status === "submitted" || status === "streaming";

  // Radix layers dismiss on Escape in the capture phase and mark the event
  // handled, so this only stops a reply when no menu or dialog consumed it.
  useEffect(() => {
    if (!isBusy) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !event.isComposing
      ) {
        stop();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, stop]);

  useEffect(() => {
    const currentInput = input;
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    const nextHeight = Math.min(
      MAX_TEXTAREA_HEIGHT,
      Math.max(MIN_TEXTAREA_HEIGHT, textarea.scrollHeight)
    );
    if (currentInput.length === 0 && nextHeight === MIN_TEXTAREA_HEIGHT) {
      textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
      setTextareaHeight(`${MIN_TEXTAREA_HEIGHT}px`);
      return;
    }

    textarea.style.height = `${nextHeight}px`;
    setTextareaHeight(`${nextHeight}px`);
  }, [input]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleRemoveAttachment = useCallback(
    (attachment: Attachment) => {
      setAttachments((current) =>
        current.filter((item) => item.url !== attachment.url)
      );

      if (!attachment.url) {
        return;
      }

      fetch("/api/files/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: attachment.url }),
      }).catch(() => {
        // Best-effort storage cleanup; the local state is already updated.
      });
    },
    [setAttachments]
  );

  const hasActiveSettings = !!customSystemPrompt || autoDocumentGeneration;

  return (
    <div className="relative">
      <div className="flex flex-col rounded-[20px] border border-transparent bg-secondary/86 px-2.5 py-2 backdrop-blur-[16px] transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:shadow-glow">
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row gap-2 overflow-x-auto px-0.5 pt-1.5 pb-1.5"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                className="size-[46px]"
                key={attachment.url}
                onRemove={() => handleRemoveAttachment(attachment)}
              />
            ))}
            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{ url: "", name: filename, contentType: "" }}
                className="size-[46px]"
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}

        <textarea
          aria-label="Message"
          autoFocus
          className="block w-full resize-none border-0 bg-transparent px-2 pt-[7px] pb-[5px] text-base text-foreground leading-[1.6] outline-hidden placeholder:text-muted-foreground focus:ring-0 disabled:opacity-50 md:text-[15px]"
          onChange={handleInput}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              if (isBusy) {
                toast.error(
                  "Please wait for the model to finish its response!"
                );
              } else if (isAuthenticated) {
                submitForm();
              } else {
                setShowLoginDialog(true);
              }
            }
          }}
          placeholder="Ask anything"
          ref={textareaRef}
          rows={1}
          style={{ height: textareaHeight }}
          value={input}
        />

        <div className="flex items-center gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <FileInput
              isAuthenticated={isAuthenticated}
              setAttachments={setAttachments}
              setShowLoginDialog={setShowLoginDialog}
              setUploadQueue={setUploadQueue}
              uploadQueue={uploadQueue}
            />
            <ModelsPopover
              onSelectModel={onSelectModel}
              selectedModelId={selectedModelId}
            />
            <button
              aria-pressed={useSearch}
              className={cn(
                "inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-[7px] rounded-[10px] px-2 font-medium text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5",
                useSearch
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={() => setUseSearch((prev) => !prev)}
              title={useSearch ? "Web search on" : "Web search off"}
              type="button"
            >
              <Globe aria-hidden className="size-[17px]" />
              <span className="sr-only sm:not-sr-only">Search</span>
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="Chat settings"
                  className={cn(
                    "inline-flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    hasActiveSettings
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                  )}
                  title="Chat settings"
                  type="button"
                >
                  <Settings2 aria-hidden className="size-[17px]" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-64 p-1"
                side="top"
                sideOffset={8}
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between px-2.5 py-2">
                    <Label
                      className="cursor-pointer text-sm"
                      htmlFor="document-toggle"
                    >
                      Auto document
                    </Label>
                    <Switch
                      checked={autoDocumentGeneration}
                      id="document-toggle"
                      onCheckedChange={(checked) =>
                        setAutoDocumentGeneration(checked)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 px-2.5 py-2">
                    <div className="flex items-center justify-between">
                      <Label
                        className="cursor-pointer text-sm"
                        htmlFor="system-prompt-toggle"
                      >
                        Custom prompt
                      </Label>
                      <Switch
                        checked={!!customSystemPrompt}
                        id="system-prompt-toggle"
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSystemPromptDraft(customSystemPrompt ?? "");
                            setShowSystemPromptDialog(true);
                          } else {
                            setCustomSystemPrompt(undefined);
                            setSystemPromptDraft("");
                            if (chatId) {
                              fetch(`/api/chats/${chatId}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ systemPrompt: null }),
                              }).catch(() => {
                                // Ignore prompt sync failures.
                              });
                            }
                            toast.success("System prompt reset to default");
                          }
                        }}
                      />
                    </div>
                    {customSystemPrompt && (
                      <button
                        className="cursor-pointer truncate text-left text-muted-foreground text-xs transition-colors hover:text-foreground"
                        onClick={() => {
                          setSystemPromptDraft(customSystemPrompt ?? "");
                          setShowSystemPromptDialog(true);
                        }}
                        type="button"
                      >
                        {customSystemPrompt.slice(0, 50)}... — Edit
                      </button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {isBusy ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <SendButton
              input={input}
              submitForm={submitForm}
              uploadQueue={uploadQueue}
            />
          )}
        </div>
      </div>

      <Dialog
        onOpenChange={setShowSystemPromptDialog}
        open={showSystemPromptDialog}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Custom system prompt</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Tell the AI how it should behave for this chat.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-card p-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            onChange={(e) => setSystemPromptDraft(e.target.value)}
            placeholder="You are a helpful assistant..."
            rows={5}
            value={systemPromptDraft}
          />
          <DialogFooter>
            <Button
              className="rounded-lg"
              onClick={() => setShowSystemPromptDialog(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="rounded-lg"
              onClick={() => {
                const trimmed = systemPromptDraft.trim();
                const newPrompt = trimmed || undefined;
                setCustomSystemPrompt(newPrompt);
                setShowSystemPromptDialog(false);
                if (chatId) {
                  fetch(`/api/chats/${chatId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ systemPrompt: newPrompt ?? null }),
                  }).catch(() => {
                    // Ignore prompt sync failures.
                  });
                }
                toast.success(
                  newPrompt
                    ? "Custom system prompt saved"
                    : "System prompt reset to default"
                );
              }}
              type="button"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoginContent onOpenChange={setShowLoginDialog} open={showLoginDialog} />
    </div>
  );
}

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <button
      aria-label="Stop generating"
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
      data-testid="stop-button"
      onClick={(e) => {
        e.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
      type="button"
    >
      <CircleStop aria-hidden className="size-[18px]" />
    </button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: string[];
}) {
  const enabled = input.trim().length > 0 && uploadQueue.length === 0;
  return (
    <button
      aria-label="Send message"
      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground transition-[background-color,opacity] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary disabled:cursor-default disabled:opacity-45"
      disabled={!enabled}
      onClick={(e) => {
        e.preventDefault();
        submitForm();
      }}
      type="submit"
    >
      <ArrowUp aria-hidden className="size-[18px]" strokeWidth={2.2} />
    </button>
  );
}

const SendButton = memo(PureSendButton);
