import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import type { Attachment } from "ai";
import {
  useRef,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
} from "react";
import { useUploadThing } from "@/lib/uploadthing/uploadthing";

interface FileInputProps {
  uploadQueue: string[];
  setUploadQueue: Dispatch<SetStateAction<string[]>>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
}

export function FileInput({
  uploadQueue,
  setUploadQueue,
  setAttachments,
}: FileInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      if (res) {
        const newAttachments = res.map((file) => ({
          url: file.url,
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
      if (files.length === 0) return;

      setUploadQueue(files.map((file) => file.name));

      await startUpload(files);
    },
    [startUpload, setUploadQueue]
  );

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative flex flex-row gap-2">
      <input
        type="file"
        className="sr-only"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
        aria-label="Upload files"
      />
      <button
        type="button"
        className="text-neutral-300 hover:text-neutral-100"
        onClick={handlePaperclipClick}
        aria-label="Attach files"
        disabled={isUploading}
      >
        <Paperclip className="size-4" />
      </button>
      {uploadQueue.length > 0 && (
        <div className="bg-neutral-800 text-neutral-200 text-xs p-1">
          Uploading {uploadQueue.length} file(s)...
        </div>
      )}
    </div>
  );
}
