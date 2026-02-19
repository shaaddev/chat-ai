"use client";

import { Bold, Download, Italic, List, Save, Underline } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createDocumentBlob,
  createFileName,
  type ExportFormat,
  downloadBlob,
} from "@/lib/document-export";
import { useUploadThing } from "@/lib/uploadthing/uploadthing";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface DocumentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHtml: string;
  initialTitle?: string;
  suggestedFormat?: ExportFormat;
}

function formatToMimeType(format: ExportFormat) {
  return format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export function DocumentSheet({
  open,
  onOpenChange,
  initialHtml,
  initialTitle,
  suggestedFormat = "docx",
}: DocumentSheetProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<ExportFormat>(suggestedFormat);
  const [editorHtml, setEditorHtml] = useState<string>(initialHtml);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    onUploadError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  useEffect(() => {
    setFormat(suggestedFormat);
  }, [suggestedFormat, initialTitle]);

  useEffect(() => {
    setEditorHtml(initialHtml);
    setSavedUrl(null);
  }, [initialHtml, initialTitle]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (editor.innerHTML !== editorHtml) {
      editor.innerHTML = editorHtml;
    }
  }, [editorHtml]);

  const applyFormat = (command: string) => {
    document.execCommand(command);
    const html = editorRef.current?.innerHTML || "";
    setEditorHtml(html);
  };

  const generateBlob = async () => {
    const html = editorRef.current?.innerHTML || editorHtml;
    const blob = await createDocumentBlob({
      html,
      format,
      title: initialTitle,
    });
    return blob;
  };

  const handleDownload = async () => {
    try {
      const blob = await generateBlob();
      const filename = createFileName(initialTitle, format);
      downloadBlob(blob, filename);
      toast.success("Document downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to download document");
    }
  };

  const handleSave = async () => {
    try {
      const blob = await generateBlob();
      const filename = createFileName(initialTitle, format);
      const file = new File([blob], filename, { type: formatToMimeType(format) });
      const uploaded = await startUpload([file]);

      const url = uploaded?.[0]?.ufsUrl;
      if (!url) {
        throw new Error("No uploaded URL returned");
      }

      setSavedUrl(url);
      toast.success("Document saved to cloud");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save document");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-neutral-900 border-neutral-700 text-neutral-100"
      >
        <SheetHeader>
          <SheetTitle className="text-neutral-100">Document Builder</SheetTitle>
          <SheetDescription className="text-neutral-400">
            Edit, switch format, then download or save to cloud.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-neutral-700 hover:bg-neutral-800"
            onClick={() => applyFormat("bold")}
            title="Bold"
          >
            <Bold className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-neutral-700 hover:bg-neutral-800"
            onClick={() => applyFormat("italic")}
            title="Italic"
          >
            <Italic className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-neutral-700 hover:bg-neutral-800"
            onClick={() => applyFormat("underline")}
            title="Underline"
          >
            <Underline className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-neutral-700 hover:bg-neutral-800"
            onClick={() => applyFormat("insertUnorderedList")}
            title="Bullet list"
          >
            <List className="size-4" />
          </Button>
          <select
            aria-label="Document format"
            className="ml-auto h-9 rounded-md border border-neutral-700 bg-neutral-800 px-3 text-sm text-neutral-100"
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
          >
            <option value="docx">DOCX</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div className="px-4 py-3 min-h-0 flex-1">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) =>
              setEditorHtml((e.target as HTMLDivElement).innerHTML)
            }
            className="h-full min-h-[320px] max-h-[65vh] overflow-auto rounded-lg border border-neutral-700 bg-neutral-800 p-4 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-neutral-500"
          />
        </div>

        <SheetFooter className="border-t border-neutral-800">
          <Button
            type="button"
            variant="outline"
            className="bg-transparent border-neutral-700 hover:bg-neutral-800"
            onClick={handleDownload}
          >
            <Download className="mr-2 size-4" />
            Download
          </Button>
          <Button
            type="button"
            className="bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
            disabled={isUploading}
            onClick={handleSave}
          >
            <Save className="mr-2 size-4" />
            {isUploading ? "Saving..." : "Save to cloud"}
          </Button>
          {savedUrl ? (
            <a
              href={savedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-300 underline underline-offset-2"
            >
              Open saved file
            </a>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
