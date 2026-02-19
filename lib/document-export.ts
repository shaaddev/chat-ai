import { Document, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

export type ExportFormat = "docx" | "pdf";

function htmlToPlainText(html: string): string {
  if (typeof window === "undefined") return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function toSafeFileStem(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "document";
}

export async function createDocumentBlob(params: {
  html: string;
  format: ExportFormat;
  title?: string;
}): Promise<Blob> {
  const plainText = htmlToPlainText(params.html);
  const text = plainText || "Untitled document";
  const lines = text.split("\n");

  if (params.format === "docx") {
    const doc = new Document({
      sections: [
        {
          children: lines.map(
            (line) =>
              new Paragraph({
                children: [new TextRun(line || " ")],
              }),
          ),
        },
      ],
    });

    return Packer.toBlob(doc);
  }

  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 56;
  const lineHeight = 18;
  const contentWidth = pageWidth - marginX * 2;

  let cursorY = marginTop;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);

  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line || " ", contentWidth) as string[];
    for (const segment of wrapped) {
      if (cursorY > pageHeight - marginTop) {
        pdf.addPage();
        cursorY = marginTop;
      }
      pdf.text(segment, marginX, cursorY);
      cursorY += lineHeight;
    }
  }

  const arrayBuffer = pdf.output("arraybuffer");
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

export function createFileName(title: string | undefined, format: ExportFormat) {
  const stem = toSafeFileStem(title || "document");
  const date = new Date().toISOString().slice(0, 10);
  return `${stem}-${date}.${format}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
