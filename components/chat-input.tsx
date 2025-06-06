import { ModelsPopover } from "./models-popover";
import { FileInput } from "./file-input";
import { Button } from "@/components/ui/button";
import { Send, CirclePause } from "lucide-react";
import { toast } from "sonner";
import { ChatRequestOptions, type Attachment } from "ai";
import {
  useCallback,
  useState,
  useRef,
  useEffect,
  type Dispatch,
  type SetStateAction,
  memo,
} from "react";
import { LoginContent } from "./auth/login-content";
import { useChat } from "@/components/chat-context";
import { PreviewAttachment } from "./preview-attachment";
import { UseChatHelpers } from "ai/react";

interface ChatInputProps {
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  input: string;
  handleInputChange: (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  status: UseChatHelpers["status"];
  chatId: string | undefined;
  initialChatModel: string;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  isAuthenticated?: boolean;
  setMessages: UseChatHelpers["setMessages"];
}

export function ChatInput({
  handleSubmit,
  input,
  handleInputChange,
  status,
  chatId,
  initialChatModel,
  isAuthenticated,
  attachments,
  setAttachments,
  setMessages,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState("72px");
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const { refreshChats } = useChat();
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, "", `/chat/${chatId}`);

    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);

    setTimeout(() => {
      refreshChats();
    }, 500);
  }, [
    handleSubmit,
    chatId,
    isAuthenticated,
    refreshChats,
    attachments,
    setAttachments,
  ]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    const newHeight = Math.min(256, Math.max(72, textarea.scrollHeight));
    textarea.style.height = `${newHeight}px`;
    setTextareaHeight(`${newHeight}px`);
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const customHandleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    handleInputChange(e);
    adjustTextareaHeight();
  };

  return (
    <div className="relative">
      <div className="relative rounded-t-2xl shadow-lg bg-neutral-800/50 flex grow flex-col">
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
            onChange={customHandleInputChange}
            placeholder="Type your message here..."
            className="w-full resize-none bg-transparent border-0 focus:ring-0 text-base text-neutral-100 placeholder-neutral-400 p-6 pt-4  outline-hidden disabled:opacity-0 "
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

      <LoginContent open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers["setMessages"];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="absolute bottom-3 right-3 bg-transparent hover:bg-neutral-800 rounded-xl"
      onClick={(e) => {
        e.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <CirclePause className="size-5 text-white" />
    </Button>
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
    <Button
      type="submit"
      className="absolute bottom-3 right-3 bg-transparent hover:bg-neutral-800 rounded-xl"
      disabled={!input.trim() || uploadQueue.length > 0}
      onClick={(e) => {
        e.preventDefault();
        submitForm();
      }}
    >
      <Send className="size-5 text-white" />
    </Button>
  );
}

const SendButton = memo(PureSendButton);
