import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowUp, CircleStop, Settings2 } from "lucide-react";
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
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LoginContent } from "./auth/login-content";
import { FileInput } from "./file-input";
import { ModelsPopover } from "./models-popover";
import { PreviewAttachment } from "./preview-attachment";

interface ChatInputProps {
  setInput: Dispatch<SetStateAction<string>>;
  input: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  stop: () => void;
  status: UseChatHelpers<ChatMessage>["status"];
  chatId: string | undefined;
  initialChatModel: string;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  isAuthenticated?: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  useSearch: boolean;
  setUseSearch: Dispatch<SetStateAction<boolean>>;
  autoDocumentGeneration: boolean;
  setAutoDocumentGeneration: Dispatch<SetStateAction<boolean>>;
  clearChatInputState: (chatId: string) => void;
  customSystemPrompt?: string;
  setCustomSystemPrompt: Dispatch<SetStateAction<string | undefined>>;
}

export function ChatInput({
  setInput,
  input,
  sendMessage,
  stop,
  status,
  chatId,
  initialChatModel,
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
  const [textareaHeight, setTextareaHeight] = useState("56px");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSystemPromptDialog, setShowSystemPromptDialog] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState(
    customSystemPrompt ?? "",
  );
  const { addOptimisticChat, setChatLoading } = useChat();
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, "", `/chat/${chatId}`);

    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }

    setChatLoading(chatId!, true);

    addOptimisticChat({
      id: chatId!,
      title: input.trim().slice(0, 80) || "New chat",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      sendMessage(
        {
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
        },
        { body: { useSearch, customSystemPrompt, autoDocumentGeneration } },
      );
    } catch (error) {
      setChatLoading(chatId!, false);
      throw error;
    }

    clearChatInputState(chatId!);
    setAttachments([]);
    setInput("");
    setUseSearch(false);
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
    useSearch,
    autoDocumentGeneration,
    clearChatInputState,
    setUseSearch,
    customSystemPrompt,
  ]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "56px";
    const newHeight = Math.min(200, Math.max(56, textarea.scrollHeight));
    textarea.style.height = `${newHeight}px`;
    setTextareaHeight(`${newHeight}px`);
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const hasActiveSettings =
    useSearch || !!customSystemPrompt || autoDocumentGeneration;

  return (
    <div className="relative">
      <div className="rounded-2xl border border-border bg-card shadow-sm flex flex-col overflow-hidden transition-shadow focus-within:shadow-md focus-within:border-ring/30">
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            data-testid="attachments-preview"
            className="flex flex-row gap-2 overflow-x-auto p-3 pb-0"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.url}
                attachment={attachment}
                className="size-20"
              />
            ))}
            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{ url: "", name: filename, contentType: "" }}
                isUploading={true}
                className="size-20"
              />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          placeholder="Message..."
          className="w-full resize-none bg-transparent border-0 focus:ring-0 text-[15px] text-foreground placeholder:text-muted-foreground/50 px-4 pt-3.5 pb-0 outline-hidden disabled:opacity-50"
          rows={1}
          autoFocus
          style={{ height: textareaHeight }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (status !== "ready") {
                toast.error(
                  "Please wait for the model to finish its response!",
                );
              } else if (!isAuthenticated) {
                setShowLoginDialog(true);
              } else {
                submitForm();
              }
            }
          }}
        />

        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            <ModelsPopover selectedModelId={initialChatModel} />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors cursor-pointer",
                    hasActiveSettings
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Settings2 className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-64 bg-popover border-border p-0"
              >
                <div className="flex flex-col divide-y divide-border">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <Label
                      htmlFor="search-toggle"
                      className="text-sm cursor-pointer"
                    >
                      Web Search
                    </Label>
                    <Switch
                      id="search-toggle"
                      checked={useSearch}
                      onCheckedChange={(checked) => setUseSearch(checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <Label
                      htmlFor="document-toggle"
                      className="text-sm cursor-pointer"
                    >
                      Auto Document
                    </Label>
                    <Switch
                      id="document-toggle"
                      checked={autoDocumentGeneration}
                      onCheckedChange={(checked) =>
                        setAutoDocumentGeneration(checked)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="system-prompt-toggle"
                        className="text-sm cursor-pointer"
                      >
                        Custom Prompt
                      </Label>
                      <Switch
                        id="system-prompt-toggle"
                        checked={!!customSystemPrompt}
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
                              }).catch(() => {});
                            }
                            toast.success("System prompt reset to default");
                          }
                        }}
                      />
                    </div>
                    {customSystemPrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          setSystemPromptDraft(customSystemPrompt ?? "");
                          setShowSystemPromptDialog(true);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground text-left truncate transition-colors cursor-pointer"
                      >
                        {customSystemPrompt.slice(0, 50)}... — Edit
                      </button>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <FileInput
              uploadQueue={uploadQueue}
              setUploadQueue={setUploadQueue}
              setAttachments={setAttachments}
              isAuthenticated={isAuthenticated}
              setShowLoginDialog={setShowLoginDialog}
            />
          </div>

          {status === "submitted" || status === "streaming" ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <SendButton
              input={input}
              uploadQueue={uploadQueue}
              submitForm={submitForm}
            />
          )}
        </div>
      </div>

      <Dialog
        open={showSystemPromptDialog}
        onOpenChange={setShowSystemPromptDialog}
      >
        <DialogContent className="sm:max-w-lg bg-popover border-border">
          <DialogHeader>
            <DialogTitle>Custom System Prompt</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Tell the AI how it should behave for this chat.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={systemPromptDraft}
            onChange={(e) => setSystemPromptDraft(e.target.value)}
            placeholder="You are a helpful assistant..."
            className="w-full min-h-[120px] resize-y rounded-lg border border-border bg-muted p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            rows={5}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSystemPromptDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
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
                  }).catch(() => {});
                }
                toast.success(
                  newPrompt
                    ? "Custom system prompt saved"
                    : "System prompt reset to default",
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoginContent open={showLoginDialog} onOpenChange={setShowLoginDialog} />
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
      data-testid="stop-button"
      className="size-8 rounded-lg bg-foreground flex items-center justify-center hover:bg-foreground/80 transition-colors cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <CircleStop className="size-4 text-background" />
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
      type="submit"
      className={cn(
        "size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
        enabled
          ? "bg-foreground hover:bg-foreground/80"
          : "bg-muted cursor-default",
      )}
      disabled={!enabled}
      onClick={(e) => {
        e.preventDefault();
        submitForm();
      }}
    >
      <ArrowUp
        className={cn(
          "size-4",
          enabled ? "text-background" : "text-muted-foreground/50",
        )}
      />
    </button>
  );
}

const SendButton = memo(PureSendButton);
