import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { jsPDF } from "jspdf";

export type ExportFormat = "docx" | "pdf";

const INLINE_MARKDOWN_REGEX = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
const HEADING_REGEX = /^(#{1,6})\s+(.+)/;
const UNORDERED_LIST_REGEX = /^[-*]\s/;
const UNORDERED_LIST_PREFIX_REGEX = /^[-*]\s+/;
const ORDERED_LIST_REGEX = /^\d+\.\s/;
const ORDERED_LIST_PREFIX_REGEX = /^\d+\.\s+/;

function toSafeFileStem(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "document";
}

// ── Markdown block types ──

type MdBlock =
  | { type: "heading"; level: number; runs: InlineRun[] }
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "list-item"; runs: InlineRun[] }
  | { type: "code"; lang: string; content: string };

interface InlineRun {
  bold?: boolean;
  code?: boolean;
  italic?: boolean;
  text: string;
}

// ── Markdown → blocks parser ──

function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const regex = new RegExp(INLINE_MARKDOWN_REGEX);
  let match = regex.exec(text);

  while (match !== null) {
    if (match[2]) {
      runs.push({ text: match[2], bold: true });
    } else if (match[3]) {
      runs.push({ text: match[3], italic: true });
    } else if (match[4]) {
      runs.push({ text: match[4], code: true });
    } else if (match[5]) {
      runs.push({ text: match[5] });
    }

    match = regex.exec(text);
  }

  return runs.length > 0 ? runs : [{ text }];
}

function parseMarkdownBlocks(md: string): MdBlock[] {
  const lines = md.split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        runs: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }

    if (UNORDERED_LIST_REGEX.test(line)) {
      const content = line.replace(UNORDERED_LIST_PREFIX_REGEX, "");
      blocks.push({ type: "list-item", runs: parseInline(content) });
      i++;
      continue;
    }

    if (ORDERED_LIST_REGEX.test(line)) {
      const content = line.replace(ORDERED_LIST_PREFIX_REGEX, "");
      blocks.push({ type: "list-item", runs: parseInline(content) });
      i++;
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    blocks.push({ type: "paragraph", runs: parseInline(line) });
    i++;
  }

  return blocks;
}

// ── Heading level map ──

const HEADING_MAP: Record<
  number,
  (typeof HeadingLevel)[keyof typeof HeadingLevel]
> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const HEADING_FONT_SIZE: Record<number, number> = {
  1: 32,
  2: 26,
  3: 22,
  4: 20,
  5: 18,
  6: 16,
};

// ── DOCX generation ──

function inlineRunsToTextRuns(runs: InlineRun[]): TextRun[] {
  return runs.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold || undefined,
        italics: run.italic || undefined,
        font: run.code ? "Courier New" : undefined,
        size: run.code ? 20 : undefined,
        shading: run.code
          ? { fill: "E8E8E8", color: "auto", type: "clear" as const }
          : undefined,
      })
  );
}

function blocksToDocxParagraphs(blocks: MdBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        paragraphs.push(
          new Paragraph({
            heading: HEADING_MAP[block.level] ?? HeadingLevel.HEADING_1,
            children: block.runs.map(
              (run) =>
                new TextRun({
                  text: run.text,
                  bold: true,
                  size: (HEADING_FONT_SIZE[block.level] ?? 24) * 2,
                  font: run.code ? "Courier New" : undefined,
                })
            ),
          })
        );
        break;

      case "list-item":
        paragraphs.push(
          new Paragraph({
            numbering: { reference: "bullet-list", level: 0 },
            children: inlineRunsToTextRuns(block.runs),
          })
        );
        break;

      case "code": {
        const codeLines = block.content.split("\n");
        for (const codeLine of codeLines) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: codeLine || " ",
                  font: "Courier New",
                  size: 20,
                }),
              ],
              shading: {
                fill: "F0F0F0",
                color: "auto",
                type: "clear" as const,
              },
            })
          );
        }
        break;
      }

      case "paragraph":
        paragraphs.push(
          new Paragraph({
            children: inlineRunsToTextRuns(block.runs),
            spacing: { after: 120 },
          })
        );
        break;
      default:
        break;
    }
  }

  return paragraphs;
}

// ── PDF generation ──

const PDF_HEADING_SIZE: Record<number, number> = {
  1: 22,
  2: 18,
  3: 16,
  4: 14,
  5: 13,
  6: 12,
};

function renderBlocksToPdf(blocks: MdBlock[], pdf: jsPDF) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 56;
  const contentWidth = pageWidth - marginX * 2;
  let cursorY = marginTop;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - marginTop) {
      pdf.addPage();
      cursorY = marginTop;
    }
  };

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const fontSize = PDF_HEADING_SIZE[block.level] ?? 14;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(fontSize);
        const text = block.runs.map((r) => r.text).join("");
        const wrapped = pdf.splitTextToSize(text, contentWidth) as string[];
        ensureSpace(fontSize * 1.5 * wrapped.length);
        for (const seg of wrapped) {
          pdf.text(seg, marginX, cursorY);
          cursorY += fontSize * 1.5;
        }
        cursorY += 4;
        break;
      }

      case "list-item": {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        const text = `\u2022  ${block.runs.map((r) => r.text).join("")}`;
        const wrapped = pdf.splitTextToSize(
          text,
          contentWidth - 16
        ) as string[];
        ensureSpace(18 * wrapped.length);
        for (const seg of wrapped) {
          pdf.text(seg, marginX + 16, cursorY);
          cursorY += 18;
        }
        break;
      }

      case "code": {
        pdf.setFont("courier", "normal");
        pdf.setFontSize(10);
        const codeLines = block.content.split("\n");
        ensureSpace(14 * codeLines.length + 8);
        cursorY += 4;
        for (const codeLine of codeLines) {
          const wrapped = pdf.splitTextToSize(
            codeLine || " ",
            contentWidth - 16
          ) as string[];
          for (const seg of wrapped) {
            ensureSpace(14);
            pdf.text(seg, marginX + 8, cursorY);
            cursorY += 14;
          }
        }
        cursorY += 4;
        break;
      }

      case "paragraph": {
        const parts = block.runs;
        let lineText = "";
        for (const part of parts) {
          lineText += part.text;
        }
        const hasBold = parts.some((p) => p.bold);
        const hasItalic = parts.some((p) => p.italic);
        const hasCode = parts.some((p) => p.code);

        if (hasCode) {
          pdf.setFont("courier", "normal");
        } else if (hasBold && hasItalic) {
          pdf.setFont("helvetica", "bolditalic");
        } else if (hasBold) {
          pdf.setFont("helvetica", "bold");
        } else if (hasItalic) {
          pdf.setFont("helvetica", "italic");
        } else {
          pdf.setFont("helvetica", "normal");
        }
        pdf.setFontSize(12);

        const wrapped = pdf.splitTextToSize(lineText, contentWidth) as string[];
        ensureSpace(18 * wrapped.length);
        for (const seg of wrapped) {
          pdf.text(seg, marginX, cursorY);
          cursorY += 18;
        }
        break;
      }
      default:
        break;
    }
  }
}

// ── Public API ──

export async function createDocumentBlob(params: {
  markdown: string;
  format: ExportFormat;
  title?: string;
}): Promise<Blob> {
  const blocks = parseMarkdownBlocks(params.markdown);

  if (params.format === "docx") {
    const docParagraphs = blocksToDocxParagraphs(blocks);

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: "bullet-list",
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "\u2022",
                alignment: AlignmentType.LEFT,
              },
            ],
          },
        ],
      },
      sections: [
        {
          children:
            docParagraphs.length > 0
              ? docParagraphs
              : [new Paragraph({ children: [new TextRun(" ")] })],
        },
      ],
    });

    return Packer.toBlob(doc);
  }

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  if (blocks.length > 0) {
    renderBlocksToPdf(blocks, pdf);
  } else {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text("Untitled document", 48, 56);
  }

  const arrayBuffer = pdf.output("arraybuffer");
  return new Blob([arrayBuffer], { type: "application/pdf" });
}

export function createFileName(
  title: string | undefined,
  format: ExportFormat
) {
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
