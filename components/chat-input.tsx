import type { UseChatHelpers } from "@ai-sdk/react";
import { CirclePause, Send, Settings2 } from "lucide-react";
import { motion } from "motion/react";
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
  const [textareaHeight, setTextareaHeight] = useState("72px");
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

    textarea.style.height = "72px";

    const newHeight = Math.min(256, Math.max(72, textarea.scrollHeight));
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

  return (
    <div className="relative">
      <div className="relative rounded-2xl shadow-lg bg-muted/50 backdrop-blur-sm border border-border/50 flex grow flex-col transition-shadow focus-within:shadow-xl focus-within:border-border">
        <form className="relative sm:max-w-3xl px-5 lg:px-0">
          {(attachments.length > 0 || uploadQueue.length > 0) && (
            <div
              data-testid="attachments-preview"
              className="flex flex-row gap-2 overflow-x-scroll p-2"
            >
              {attachments.map((attachment) => (
                <PreviewAttachment
                  key={attachment.url}
                  attachment={attachment}
                  className="size-24"
                />
              ))}

              {uploadQueue.map((filename) => (
                <PreviewAttachment
                  key={filename}
                  attachment={{
                    url: "",
                    name: filename,
                    contentType: "",
                  }}
                  isUploading={true}
                  className="size-24"
                />
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            placeholder="Type your message here..."
            className="w-full resize-none bg-transparent border-0 focus:ring-0 text-base text-foreground placeholder:text-muted-foreground p-6 pt-4 outline-hidden disabled:opacity-0"
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
                } else {
                  if (!isAuthenticated) {
                    setShowLoginDialog(true);
                  } else {
                    submitForm();
                  }
                }
              }
            }}
          />
          <div className="flex flex-row gap-5 items-center py-2 px-5">
            <ModelsPopover selectedModelId={initialChatModel} />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "px-2 rounded-full bg-transparent cursor-pointer",
                    (useSearch ||
                      customSystemPrompt ||
                      autoDocumentGeneration) &&
                      "bg-primary text-primary-foreground",
                  )}
                >
                  <Settings2 className="size-4! mr-1" />
                  Settings
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-72 bg-popover border-border p-0"
              >
                <div className="flex flex-col divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <Label
                      htmlFor="search-toggle"
                      className="text-sm text-foreground cursor-pointer"
                    >
                      Web Search
                    </Label>
                    <Switch
                      id="search-toggle"
                      checked={useSearch}
                      onCheckedChange={(checked) => setUseSearch(checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <Label
                      htmlFor="document-toggle"
                      className="text-sm text-foreground cursor-pointer"
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

                  <div className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="system-prompt-toggle"
                        className="text-sm text-foreground cursor-pointer"
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
                        className="text-xs text-muted-foreground hover:text-foreground text-left truncate transition-colors"
                      >
                        {customSystemPrompt.slice(0, 60)}
                        {customSystemPrompt.length > 60 ? "..." : ""} — Edit
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
          {status === "submitted" ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <SendButton
              input={input}
              uploadQueue={uploadQueue}
              submitForm={submitForm}
            />
          )}
        </form>
      </div>

      <Dialog
        open={showSystemPromptDialog}
        onOpenChange={setShowSystemPromptDialog}
      >
        <DialogContent className="sm:max-w-lg bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Custom System Prompt
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Tell the AI how it should behave for this chat. Leave empty to
              keep the default.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={systemPromptDraft}
            onChange={(e) => setSystemPromptDraft(e.target.value)}
            placeholder="You are a friendly assistant! Keep your responses concise and helpful."
            className="w-full min-h-[120px] resize-y rounded-lg border border-border bg-muted p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows={5}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="bg-transparent border-border text-muted-foreground hover:bg-accent"
              onClick={() => setShowSystemPromptDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const trimmed = systemPromptDraft.trim();
                const newPrompt = trimmed || undefined;
                setCustomSystemPrompt(newPrompt);
                setShowSystemPromptDialog(false);
                if (chatId) {
                  fetch(`/api/chats/${chatId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      systemPrompt: newPrompt ?? null,
                    }),
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
    <motion.div whileTap={{ scale: 0.9 }} className="absolute bottom-3 right-3">
      <Button
        data-testid="stop-button"
        className="bg-transparent hover:bg-accent rounded-xl cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          stop();
          setMessages((messages) => messages);
        }}
      >
        <CirclePause className="size-5 text-foreground" />
      </Button>
    </motion.div>
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
  return (
    <motion.div whileTap={{ scale: 0.9 }} className="absolute bottom-3 right-3">
      <Button
        type="submit"
        className="bg-transparent hover:bg-accent rounded-xl cursor-pointer"
        disabled={!input.trim() || uploadQueue.length > 0}
        onClick={(e) => {
          e.preventDefault();
          submitForm();
        }}
      >
        <Send className="size-5 text-foreground" />
      </Button>
    </motion.div>
  );
}

const SendButton = memo(PureSendButton);
