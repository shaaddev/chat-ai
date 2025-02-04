import { ModelsPopover } from "./models-popover";
import { FileInput } from "./file-input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";
// import { useCallback } from "react";

export function ChatInput({
  handleSubmit,
  input,
  handleInputChange,
  isLoading,
  chatId,
}: any) {
  const submitForm = () => {
    handleSubmit();
  };

  return (
    <div className="relative ">
      <form
        onSubmit={handleSubmit}
        className="relative sm:max-w-3xl px-5 lg:px-0"
      >
        <div className="relative rounded-t-2xl shadow-lg bg-neutral-800/50 flex flex-grow flex-col">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message here..."
            className="w-full resize-none bg-transparent border-0 focus:ring-0 text-base text-neutral-100 placeholder-neutral-400 p-6 pt-4  outline-none disabled:opacity-0 "
            rows={1}
            autoFocus
            style={{ height: "72px !important" }}
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
          <div className="flex flex-col gap-5 md:flex-row md:items-center py-2 px-5">
            <ModelsPopover />
            <FileInput />
          </div>
          <Button
            type="submit"
            className="absolute bottom-3 right-3 bg-transparent hover:bg-neutral-700"
            disabled={!input.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
