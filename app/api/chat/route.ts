import { google } from "@ai-sdk/google";
import { type Message, streamText } from "ai";
import { systemPrompt } from "@/lib/ai/prompts";
import { generateUUID } from "@/lib/utils";
import { saveChat, saveMessages, getChatById } from "@/db/queries";
import {
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "@/app/actions";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { id, messages }: { id: string; messages: Array<Message> } =
    await req.json();

  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, title });
  }

  await saveMessages({
    messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
  });

  const res = streamText({
    model: google("gemini-1.5-pro-latest"),
    system: systemPrompt(),
    messages,
    experimental_generateMessageId: generateUUID,
    onFinish: async ({ response }) => {
      try {
        const sanitizedResponseMessages = sanitizeResponseMessages({
          messages: response.messages,
        });

        await saveMessages({
          messages: sanitizedResponseMessages.map((message) => {
            return {
              id: message.id,
              chatId: id,
              role: message.role,
              content: message.content,
              createdAt: new Date(),
            };
          }),
        });
      } catch (error) {
        console.error("Failed to save chat");
      }
    },
    // onError: () => {
    //   return "Oops, an error occurred";
    // },
  });

  return res.toDataStreamResponse();
}
