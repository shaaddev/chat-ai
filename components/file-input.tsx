import { Paperclip } from "lucide-react";
import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import type { Attachment } from "@/lib/types";
import { useUploadThing } from "@/lib/uploadthing/uploadthing";

interface FileInputProps {
  isAuthenticated?: boolean;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setShowLoginDialog: Dispatch<SetStateAction<boolean>>;
  setUploadQueue: Dispatch<SetStateAction<string[]>>;
  uploadQueue: string[];
}

export function FileInput({
  uploadQueue,
  setUploadQueue,
  setAttachments,
  isAuthenticated,
  setShowLoginDialog,
}: FileInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      if (res) {
        const newAttachments = res.map((file) => ({
          url: file.ufsUrl,
          name: file.name,
          contentType: file.type,
        }));

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...newAttachments,
        ]);

        setUploadQueue([]);
        toast.success("Files uploaded successfully!");
      }
    },
    onUploadError: (error) => {
      toast.error(`Error uploadthing file: ${error.message}`);
      setUploadQueue([]);
    },
  });

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) {
        return;
      }

      if (isAuthenticated) {
        setUploadQueue(files.map((file) => file.name));

        await startUpload(files);
      } else {
        setShowLoginDialog(true);
      }
    },
    [startUpload, setUploadQueue, setShowLoginDialog, isAuthenticated]
  );

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative flex shrink-0 flex-row">
      <input
        aria-label="Upload files"
        className="sr-only"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      <button
        aria-label="Attach files"
        className="grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50"
        disabled={isUploading}
        onClick={handlePaperclipClick}
        type="button"
      >
        <Paperclip aria-hidden className="size-[17px]" />
      </button>
      {uploadQueue.length > 0 && (
        <span className="sr-only" role="status">
          Uploading {uploadQueue.length} file(s)
        </span>
      )}
    </div>
  );
}
