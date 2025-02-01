import { Paperclip } from "lucide-react";

export function FileInput() {
  return (
    <button type="button" className="text-neutral-300 hover:text-neutral-100">
      <Paperclip className="h-5 w-5" />
    </button>
  );
}
