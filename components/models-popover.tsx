import { ChevronDown } from "lucide-react";

export function ModelsPopover() {
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-neutral-300 hover:text-neutral-100"
      >
        ChatGPT 4o mini
        <ChevronDown className="h-4 w-4" />
      </button>
    </>
  );
}
