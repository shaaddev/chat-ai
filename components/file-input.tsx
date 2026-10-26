import { Paperclip } from "lucide-react";
import { useRef } from "react";
import { ATTACHMENT_ACCEPT } from "@/lib/uploadthing/attachments";

export function FileInput({ onFiles }: { onFiles: (files: File[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        accept={ATTACHMENT_ACCEPT}
        aria-label="Upload files"
        className="sr-only"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Clearing the value lets the same file be picked again.
          event.target.value = "";
          if (files.length > 0) {
            onFiles(files);
          }
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <button
        aria-label="Attach files"
        className="touch-hitbox relative grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <Paperclip aria-hidden className="size-[17px]" />
      </button>
    </>
  );
}
