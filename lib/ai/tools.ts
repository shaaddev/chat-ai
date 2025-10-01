import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { ToolSet } from "ai";

const googleTools = google.tools;
const openaiTools = openai.tools;

export function getToolsForModel(modelId: string): ToolSet {
  if (modelId.startsWith("google-")) {
    return {
      google_search: googleTools.googleSearch({}),
      url_context: googleTools.urlContext({}),
    };
  }

  return {
    web_search: openaiTools.webSearchPreview({
      searchContextSize: "medium",
    }),
  };
}
