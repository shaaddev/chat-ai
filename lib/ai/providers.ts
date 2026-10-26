import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, type LanguageModel } from "ai";
import type { ChatMessage } from "@/lib/types";
import { TITLE_MODEL_SLUG } from "./models";
import { titlePrompt } from "./prompts";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const WEB_SEARCH_MAX_RESULTS = 5;

export const CHAT_TITLE_MAX_LENGTH = 80;
const TITLE_TIMEOUT_MS = 10_000;

export function getLanguageModel(
  slug: string,
  { useWebSearch }: { useWebSearch: boolean }
): LanguageModel {
  if (!useWebSearch) {
    return openrouter(slug);
  }
  return openrouter(slug, {
    plugins: [{ id: "web", max_results: WEB_SEARCH_MAX_RESULTS }],
  });
}

const TITLE_EDGE_PUNCTUATION = /^["'“”‘’]+|["'“”‘’.!?:]+$/g;

function messageText(message: ChatMessage) {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .slice(0, 2000);
}

export async function generateChatTitle(message: ChatMessage) {
  const { text } = await generateText({
    model: openrouter(TITLE_MODEL_SLUG),
    instructions: titlePrompt,
    prompt: `<message>${messageText(message)}</message>`,
    temperature: 0,
    abortSignal: AbortSignal.timeout(TITLE_TIMEOUT_MS),
  });
  return text
    .trim()
    .replace(TITLE_EDGE_PUNCTUATION, "")
    .slice(0, CHAT_TITLE_MAX_LENGTH);
}
