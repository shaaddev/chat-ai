import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { systemPrompt } from "@/lib/ai/prompts";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const res = streamText({
    model: google("gemini-1.5-pro-latest"),
    system: systemPrompt(),
    messages,
  });

  return res.toDataStreamResponse();
}
