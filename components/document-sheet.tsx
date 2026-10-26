"use client";

import { Bold, Code, Download, Italic, List, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createDocumentBlob,
  createFileName,
  downloadBlob,
  type ExportFormat,
} from "@/lib/document-export";
import { useUploadThing } from "@/lib/uploadthing/uploadthing";
import { Markdown } from "./markdown";
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
  initialMarkdown?: string;
  initialTitle?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
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
  initialMarkdown = "",
  initialTitle,
  suggestedFormat = "docx",
}: DocumentSheetProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [format, setFormat] = useState<ExportFormat>(suggestedFormat);
  const [markdown, setMarkdown] = useState<string>(initialMarkdown);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing("documentUploader", {
    onUploadError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  useEffect(() => {
    setFormat(suggestedFormat);
  }, [suggestedFormat]);

  useEffect(() => {
    setMarkdown(initialMarkdown);
    setSavedUrl(null);
  }, [initialMarkdown]);

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.slice(start, end);

    const newText =
      text.slice(0, start) + before + selected + after + text.slice(end);
    setMarkdown(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + before.length, end + before.length);
      } else {
        const cursorPos = start + before.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }, []);

  const insertListItem = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const text = textarea.value;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;

    const newText = `${text.slice(0, lineStart)}- ${text.slice(lineStart)}`;
    setMarkdown(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2);
    });
  }, []);

  const generateBlob = async () =>
    createDocumentBlob({ markdown, format, title: initialTitle });

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
      const file = new File([blob], filename, {
        type: formatToMimeType(format),
      });
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
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="flex w-full flex-col text-foreground sm:max-w-xl"
        side="right"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Document builder</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Edit the markdown source, preview updates live below.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 px-4">
          <Button
            className="border-border bg-transparent"
            onClick={() => wrapSelection("**", "**")}
            size="icon"
            title="Bold"
            type="button"
            variant="outline"
          >
            <Bold className="size-4" />
          </Button>
          <Button
            className="border-border bg-transparent"
            onClick={() => wrapSelection("*", "*")}
            size="icon"
            title="Italic"
            type="button"
            variant="outline"
          >
            <Italic className="size-4" />
          </Button>
          <Button
            className="border-border bg-transparent"
            onClick={() => wrapSelection("`", "`")}
            size="icon"
            title="Inline code"
            type="button"
            variant="outline"
          >
            <Code className="size-4" />
          </Button>
          <Button
            className="border-border bg-transparent"
            onClick={insertListItem}
            size="icon"
            title="Bullet list"
            type="button"
            variant="outline"
          >
            <List className="size-4" />
          </Button>

          <select
            aria-label="Document format"
            className="ml-auto h-9 rounded-lg border border-border bg-card px-3 text-foreground text-sm"
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            value={format}
          >
            <option value="docx">DOCX</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-2">
          <textarea
            className="max-h-[40%] min-h-[120px] shrink-0 resize-y rounded-xl border border-border bg-code p-3 font-mono text-foreground text-sm leading-6 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Write or edit markdown here..."
            ref={textareaRef}
            value={markdown}
          />

          <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-secondary p-4 text-sm leading-6">
            <Markdown>{markdown}</Markdown>
          </div>
        </div>

        <SheetFooter>
          <Button
            className="border-border bg-transparent"
            onClick={handleDownload}
            type="button"
            variant="outline"
          >
            <Download className="mr-2 size-4" />
            Download
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isUploading}
            onClick={handleSave}
            type="button"
          >
            <Save className="mr-2 size-4" />
            {isUploading ? "Saving..." : "Save to cloud"}
          </Button>
          {savedUrl ? (
            <a
              className="text-muted-foreground text-xs underline underline-offset-2"
              href={savedUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open saved file
            </a>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
