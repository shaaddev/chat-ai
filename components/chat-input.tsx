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
  attachments: Array<Attachment>;
  autoDocumentGeneration: boolean;
  chatId: string | undefined;
  clearChatInputState: (chatId: string) => void;
  customSystemPrompt?: string;
  initialChatModel: string;
  input: string;
  isAuthenticated?: boolean;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
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
    customSystemPrompt ?? ""
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
        { body: { useSearch, customSystemPrompt, autoDocumentGeneration } }
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
    if (!textarea) {
      return;
    }

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
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:border-ring/30 focus-within:shadow-md">
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row gap-2 overflow-x-auto p-3 pb-0"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                className="size-20"
                key={attachment.url}
              />
            ))}
            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{ url: "", name: filename, contentType: "" }}
                className="size-20"
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}

        <textarea
          autoFocus
          className="w-full resize-none border-0 bg-transparent px-4 pt-3.5 pb-0 text-[15px] text-foreground outline-hidden placeholder:text-muted-foreground/50 focus:ring-0 disabled:opacity-50"
          onChange={handleInput}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (status !== "ready") {
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
          placeholder="Message..."
          ref={textareaRef}
          rows={1}
          style={{ height: textareaHeight }}
          value={input}
        />

        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            <ModelsPopover selectedModelId={initialChatModel} />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors",
                    hasActiveSettings
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  type="button"
                >
                  <Settings2 className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-64 border-border bg-popover p-0"
                side="top"
                sideOffset={8}
              >
                <div className="flex flex-col divide-y divide-border">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <Label
                      className="cursor-pointer text-sm"
                      htmlFor="search-toggle"
                    >
                      Web Search
                    </Label>
                    <Switch
                      checked={useSearch}
                      id="search-toggle"
                      onCheckedChange={(checked) => setUseSearch(checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <Label
                      className="cursor-pointer text-sm"
                      htmlFor="document-toggle"
                    >
                      Auto Document
                    </Label>
                    <Switch
                      checked={autoDocumentGeneration}
                      id="document-toggle"
                      onCheckedChange={(checked) =>
                        setAutoDocumentGeneration(checked)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
                    <div className="flex items-center justify-between">
                      <Label
                        className="cursor-pointer text-sm"
                        htmlFor="system-prompt-toggle"
                      >
                        Custom Prompt
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
                              }).catch(() => {});
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
            <FileInput
              isAuthenticated={isAuthenticated}
              setAttachments={setAttachments}
              setShowLoginDialog={setShowLoginDialog}
              setUploadQueue={setUploadQueue}
              uploadQueue={uploadQueue}
            />
          </div>

          {status === "submitted" || status === "streaming" ? (
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
        <DialogContent className="border-border bg-popover sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Custom System Prompt</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Tell the AI how it should behave for this chat.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full resize-y rounded-lg border border-border bg-muted p-3 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onChange={(e) => setSystemPromptDraft(e.target.value)}
            placeholder="You are a helpful assistant..."
            rows={5}
            value={systemPromptDraft}
          />
          <DialogFooter>
            <Button
              onClick={() => setShowSystemPromptDialog(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
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
      className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-foreground transition-colors hover:bg-foreground/80"
      data-testid="stop-button"
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
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
        enabled
          ? "bg-foreground hover:bg-foreground/80"
          : "cursor-default bg-muted"
      )}
      disabled={!enabled}
      onClick={(e) => {
        e.preventDefault();
        submitForm();
      }}
      type="submit"
    >
      <ArrowUp
        className={cn(
          "size-4",
          enabled ? "text-background" : "text-muted-foreground/50"
        )}
      />
    </button>
  );
}

const SendButton = memo(PureSendButton);
