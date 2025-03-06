import { ModelsPopover } from "./models-popover";
import { FileInput } from "./file-input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { ChatRequestOptions } from "ai";
import { useCallback, useState, useRef, useEffect } from "react";

interface ChatInputProps {
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  input: string;
  handleInputChange: (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
  isLoading: boolean;
  chatId: string | undefined;
  handleModelChange: (model: string) => void;
}

export function ChatInput({
  handleSubmit,
  input,
  handleInputChange,
  isLoading,
  chatId,
  handleModelChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState("72px");
  const submitForm = useCallback(() => {
    window.history.replaceState({}, "", `/chat/${chatId}`);

    handleSubmit(undefined);
  }, [handleSubmit, chatId]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    const newHeight = Math.max(72, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
    setTextareaHeight(`${newHeight}px`);
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const customHandleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    handleInputChange(e);
    adjustTextareaHeight();
  };

  return (
    <div className="relative ">
      <form
        onSubmit={handleSubmit}
        className="relative sm:max-w-3xl px-5 lg:px-0"
      >
        <div className="relative rounded-t-2xl shadow-lg bg-neutral-800/50 flex flex-grow flex-col">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={customHandleInputChange}
            placeholder="Type your message here..."
            className="w-full resize-none bg-transparent border-0 focus:ring-0 text-base text-neutral-100 placeholder-neutral-400 p-6 pt-4  outline-none disabled:opacity-0 "
            rows={1}
            autoFocus
            style={{ height: textareaHeight }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();

                if (isLoading) {
                  toast.error(
                    "Please wait for the model to finish its response!"
                  );
                } else {
                  submitForm();
                }
              }
            }}
          />
          <div className="flex flex-row gap-5 items-center py-2 px-5">
            <ModelsPopover onModelChange={handleModelChange} />
            <FileInput />
          </div>
          <Button
            type="submit"
            className="absolute bottom-3 right-3 bg-transparent hover:bg-neutral-800 rounded-xl"
            disabled={!input.trim()}
          >
            <Send className="size-5 text-white" />
          </Button>
        </div>
      </form>
    </div>
  );
}
