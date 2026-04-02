import type { UIMessage } from "ai";

export interface Attachment {
  contentType: string;
  name: string;
  url: string;
}

export type ChatMessage = UIMessage;
