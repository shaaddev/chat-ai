import type { FinishReason, UIMessage } from "ai";
import type { ExportFormat } from "@/lib/document-export";

export interface Attachment {
  contentType: string;
  name: string;
  url: string;
}

export interface ChatMessageMetadata {
  createdAt?: string;
  documentCandidate?: boolean;
  finishReason?: FinishReason;
  model?: string | null;
  suggestedFormat?: ExportFormat;
  useSearch?: boolean;
}

export type ChatMessage = UIMessage<ChatMessageMetadata>;

export interface DocumentDraft {
  format: ExportFormat;
  markdown: string;
  messageId: string;
  title: string;
}
