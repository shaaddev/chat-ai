import type { UIMessage, UIMessagePart } from "ai";
import { type ClassValue, clsx } from "clsx";
import { formatISO } from "date-fns";
import { twMerge } from "tailwind-merge";
import type { Message as DbMessage } from "@/lib/db/schema";
import { ChatSDKError, type ErrorCode } from "./errors";
import type { ChatMessage } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      "An error occurred while fetching the data."
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === "user");
  return userMessages.at(-1);
}

export function convertToUIMessages(messages: DbMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts as UIMessagePart<any, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    metadata: {
      createdAt: formatISO(message.createdAt),
      model: message.model,
    },
  }));
}

export function hasVisibleContent({ parts }: Pick<ChatMessage, "parts">) {
  return parts.some(
    (part) =>
      part.type === "file" ||
      (part.type === "text" && part.text.trim().length > 0)
  );
}

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new ChatSDKError("offline:chat");
    }

    throw error;
  }
}

export function sanitizeText(text: string) {
  return text.replace("<has_function_call>", "");
}
