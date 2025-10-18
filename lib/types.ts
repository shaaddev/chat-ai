import type { UIMessage } from "ai";

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

export type ChatMessage = UIMessage;
