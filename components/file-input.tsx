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
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
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
    <div className="relative flex flex-row gap-2">
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
        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        disabled={isUploading}
        onClick={handlePaperclipClick}
        type="button"
      >
        <Paperclip className="size-4" />
      </button>
      {uploadQueue.length > 0 && (
        <div className="rounded bg-muted p-1 text-foreground text-xs">
          Uploading {uploadQueue.length} file(s)...
        </div>
      )}
    </div>
  );
}
