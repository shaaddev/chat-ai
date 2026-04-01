"use client";

import {
  Bold,
  Code,
  Download,
  Italic,
  List,
  Play,
  Save,
  Terminal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createDocumentBlob,
  createFileName,
  type ExportFormat,
  downloadBlob,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMarkdown?: string;
  initialTitle?: string;
  suggestedFormat?: ExportFormat;
}

interface CodeBlock {
  language: string;
  code: string;
}

function formatToMimeType(format: ExportFormat) {
  return format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function extractCodeBlocksFromMarkdown(md: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(md)) !== null) {
    blocks.push({
      language: match[1] || "javascript",
      code: match[2].trim(),
    });
  }
  return blocks;
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
  const [codeOutputs, setCodeOutputs] = useState<
    Map<number, { stdout: string; stderr: string; running: boolean }>
  >(new Map());

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
    setCodeOutputs(new Map());
  }, [initialMarkdown]);

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

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
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = textarea.value;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;

    const newText = text.slice(0, lineStart) + "- " + text.slice(lineStart);
    setMarkdown(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2);
    });
  }, []);

  const generateBlob = async () => {
    return createDocumentBlob({ markdown, format, title: initialTitle });
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

  const handleRunCode = async (
    index: number,
    code: string,
    language: string,
  ) => {
    setCodeOutputs((prev) => {
      const next = new Map(prev);
      next.set(index, { stdout: "", stderr: "", running: true });
      return next;
    });

    try {
      const res = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const result = await res.json();
      setCodeOutputs((prev) => {
        const next = new Map(prev);
        next.set(index, {
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          running: false,
        });
        return next;
      });
    } catch (err) {
      setCodeOutputs((prev) => {
        const next = new Map(prev);
        next.set(index, {
          stdout: "",
          stderr: String(err),
          running: false,
        });
        return next;
      });
    }
  };

  const codeBlocks = extractCodeBlocksFromMarkdown(markdown);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-background border-border text-foreground flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Document Builder</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Edit the markdown source, preview updates live below.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-border hover:bg-accent"
            onClick={() => wrapSelection("**", "**")}
            title="Bold"
          >
            <Bold className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-border hover:bg-accent"
            onClick={() => wrapSelection("*", "*")}
            title="Italic"
          >
            <Italic className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-border hover:bg-accent"
            onClick={() => wrapSelection("`", "`")}
            title="Inline code"
          >
            <Code className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="bg-transparent border-border hover:bg-accent"
            onClick={insertListItem}
            title="Bullet list"
          >
            <List className="size-4" />
          </Button>

          <select
            aria-label="Document format"
            className="ml-auto h-9 rounded-md border border-border bg-muted px-3 text-sm text-foreground"
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
          >
            <option value="docx">DOCX</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div className="px-4 py-2 min-h-0 flex-1 flex flex-col gap-3 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="min-h-[120px] max-h-[40%] shrink-0 resize-y rounded-lg border border-border bg-muted p-3 text-sm font-mono leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Write or edit markdown here..."
          />

          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-muted p-4 text-sm leading-6">
            <Markdown>{markdown}</Markdown>
          </div>
        </div>

        {codeBlocks.length > 0 && (
          <div className="px-4 pb-2 space-y-2 max-h-48 overflow-auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="size-3" />
              <span>Code Blocks</span>
            </div>
            {codeBlocks.map((block, idx) => {
              const output = codeOutputs.get(idx);
              return (
                <div
                  key={idx}
                  className="rounded-md border border-border bg-background overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                    <span className="text-xs text-muted-foreground font-mono">
                      {block.language || "code"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      disabled={output?.running}
                      onClick={() =>
                        handleRunCode(idx, block.code, block.language)
                      }
                    >
                      <Play className="size-3 mr-1" />
                      {output?.running ? "Running..." : "Run"}
                    </Button>
                  </div>
                  {output && !output.running && (
                    <div className="p-2 text-xs font-mono">
                      {output.stdout && (
                        <pre className="text-green-400 whitespace-pre-wrap">
                          {output.stdout}
                        </pre>
                      )}
                      {output.stderr && (
                        <pre className="text-red-400 whitespace-pre-wrap">
                          {output.stderr}
                        </pre>
                      )}
                      {!output.stdout && !output.stderr && (
                        <span className="text-muted-foreground/50">
                          No output
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <SheetFooter className="border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="bg-transparent border-border hover:bg-accent"
            onClick={handleDownload}
          >
            <Download className="mr-2 size-4" />
            Download
          </Button>
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              Open saved file
            </a>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
