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

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = res.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await res.json();
      toast.error(error);
      // eslint-disable-next-line
    } catch (error) {
      toast.error("Failed to upload file, please try again!");
    }
  };

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, setUploadQueue],
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
        disabled
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
