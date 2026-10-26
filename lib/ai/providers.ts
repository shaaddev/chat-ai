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

export async function generateChatTitle(message: ChatMessage) {
  const { text } = await generateText({
    model: openrouter(TITLE_MODEL_SLUG),
    instructions: titlePrompt,
    prompt: JSON.stringify(message),
  });
  return text.trim().slice(0, CHAT_TITLE_MAX_LENGTH);
}
