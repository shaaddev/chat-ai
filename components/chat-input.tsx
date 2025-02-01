import { ModelsPopover } from "./models-popover";
import { FileInput } from "./file-input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export function ChatInput({ handleSubmit, input, handleInputChange }: any) {
  return (
    <div className="relative ">
      <form
        onSubmit={handleSubmit}
        className="relative sm:max-w-3xl px-5 lg:px-0"
      >
        <div className="relative rounded-t-2xl shadow-lg bg-neutral-800/50 backdrop-blur-sm">
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <ModelsPopover />
            <FileInput />
          </div>
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message here..."
            className="w-full bg-transparent border-0 focus:ring-0 text-base text-neutral-100 placeholder-neutral-400 p-6 pt-4 resize-none outline-none disabled:opacity-0"
            rows={3}
            style={{ minHeight: "100px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
              }
            }}
          />
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
