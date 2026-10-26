import type { UseChatHelpers } from "@ai-sdk/react";
import {
  ArrowUp,
  CircleStop,
  Globe,
  LoaderCircle,
  Settings2,
} from "lucide-react";
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
import { type ChatModelId, getChatModel } from "@/lib/ai/models";
import type { TurnStatus } from "@/lib/chat-turn";
import type { ChatMessage } from "@/lib/types";
import { filesOverLimit } from "@/lib/uploadthing/tray";
import { cn } from "@/lib/utils";
import {
  ATTACHMENT_LIMIT_HINT_ID,
  AttachmentTrayList,
  getAttachmentTray,
  overLimitHint,
  useTrayReadiness,
} from "./attachment-tray";
import { LoginContent } from "./auth/login-content";
import { FileInput } from "./file-input";
import { ModelsPopover } from "./models-popover";

const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 200;

function pastedFiles(clipboard: DataTransfer): File[] {
  // Office apps copy a picture of the selection next to its text and HTML.
  // That paste is text, so only attach files when no rich text came along.
  const isRichText =
    clipboard.types.includes("text/html") &&
    clipboard.getData("text/plain").trim().length > 0;
  return isRichText ? [] : Array.from(clipboard.files);
}

interface ChatInputProps {
  autoDocumentGeneration: boolean;
  chatId: string;
  customSystemPrompt?: string;
  input: string;
  isAuthenticated?: boolean;
  onSelectModel: (modelId: ChatModelId) => void;
  selectedModelId: ChatModelId;
  sendTurn: (text: string) => void;
  setAutoDocumentGeneration: Dispatch<SetStateAction<boolean>>;
  setCustomSystemPrompt: Dispatch<SetStateAction<string | undefined>>;
  setInput: Dispatch<SetStateAction<string>>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  setUseSearch: Dispatch<SetStateAction<boolean>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  turnStatus: TurnStatus;
  useSearch: boolean;
}

export function ChatInput({
  setInput,
  input,
  sendTurn,
  stop,
  status,
  turnStatus,
  chatId,
  onSelectModel,
  selectedModelId,
  isAuthenticated,
  setMessages,
  useSearch,
  setUseSearch,
  autoDocumentGeneration,
  setAutoDocumentGeneration,
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
  const isSendHeld = turnStatus.phase === "settling" && turnStatus.held;
  const isStopping = turnStatus.phase === "running" && turnStatus.stopping;
  const tray = getAttachmentTray(chatId);
  const trayReadiness = useTrayReadiness(tray);
  const hasText = input.trim().length > 0;
  const needsText = getChatModel(selectedModelId).kind === "image";
  const canSend =
    !isSendHeld &&
    (trayReadiness === "ready" || trayReadiness === "empty") &&
    (hasText || (trayReadiness === "ready" && !needsText));

  const attachFiles = useCallback(
    (files: File[]) => {
      if (isAuthenticated) {
        tray.add(files);
      } else {
        setShowLoginDialog(true);
      }
    },
    [isAuthenticated, tray]
  );

  const submitForm = useCallback(() => {
    if (trayReadiness === "over-limit") {
      toast.error("Too many files to send", {
        description: overLimitHint(filesOverLimit(tray.getItems())),
      });
      return;
    }
    if (!canSend) {
      return;
    }
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    sendTurn(hasText ? input : "");
  }, [canSend, isAuthenticated, sendTurn, hasText, input, tray, trayReadiness]);

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

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = pastedFiles(event.clipboardData);
    if (files.length > 0) {
      event.preventDefault();
      attachFiles(files);
    }
  };

  const hasActiveSettings = !!customSystemPrompt || autoDocumentGeneration;

  return (
    <div className="relative">
      <div className="flex flex-col rounded-[20px] border border-transparent bg-secondary/86 px-2.5 py-2 backdrop-blur-[16px] transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:shadow-glow">
        <AttachmentTrayList tray={tray} />

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
              if (isStopping) {
                toast("Still stopping", {
                  description: "Send your message in a moment.",
                });
              } else if (isBusy) {
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
          onPaste={handlePaste}
          placeholder={
            needsText ? "Describe the image you want" : "Ask anything"
          }
          readOnly={isSendHeld}
          ref={textareaRef}
          rows={1}
          style={{ height: textareaHeight }}
          value={input}
        />

        <div className="flex items-center gap-1 pointer-coarse:gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 pointer-coarse:gap-2.5">
            <FileInput onFiles={attachFiles} />
            <ModelsPopover
              onSelectModel={onSelectModel}
              selectedModelId={selectedModelId}
            />
            <button
              aria-pressed={useSearch}
              className={cn(
                "touch-hitbox relative inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-[7px] rounded-[10px] px-2 font-medium text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5",
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
                    "touch-hitbox relative inline-flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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

          <ComposerAction
            canSend={canSend}
            describedBy={
              trayReadiness === "over-limit"
                ? ATTACHMENT_LIMIT_HINT_ID
                : undefined
            }
            isBusy={isBusy}
            isSendHeld={isSendHeld}
            isStopping={isStopping}
            setMessages={setMessages}
            stop={stop}
            submitForm={submitForm}
          />
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

// One button that switches between Stop and Send, so focus stays on it when
// a stop ends or a reply finishes. aria-disabled keeps it focusable.
function PureComposerAction({
  canSend,
  describedBy,
  isBusy,
  isSendHeld,
  isStopping,
  setMessages,
  stop,
  submitForm,
}: {
  canSend: boolean;
  describedBy: string | undefined;
  isBusy: boolean;
  isSendHeld: boolean;
  isStopping: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  stop: () => void;
  submitForm: () => void;
}) {
  const isInert = isBusy ? isStopping : !canSend;
  let label = "Send message";
  if (isBusy) {
    label = isStopping ? "Stopping" : "Stop generating";
  }
  const isWaiting = isStopping || isSendHeld;
  let icon = <ArrowUp aria-hidden className="size-[18px]" strokeWidth={2.2} />;
  if (isWaiting) {
    icon = <LoaderCircle aria-hidden className="size-[18px] animate-spin" />;
  } else if (isBusy) {
    icon = <CircleStop aria-hidden className="size-[18px]" />;
  }
  return (
    <button
      aria-describedby={describedBy}
      aria-disabled={isInert}
      aria-label={label}
      className="touch-hitbox relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground transition-[background-color,opacity] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary aria-disabled:cursor-default aria-disabled:opacity-45 aria-disabled:hover:bg-primary"
      data-composer-action=""
      data-testid={isBusy && !isStopping ? "stop-button" : "send-button"}
      onClick={(e) => {
        e.preventDefault();
        if (isInert) {
          return;
        }
        if (isBusy) {
          stop();
          setMessages((messages) => messages);
        } else {
          submitForm();
        }
      }}
      type="button"
    >
      {icon}
    </button>
  );
}

const ComposerAction = memo(PureComposerAction);
