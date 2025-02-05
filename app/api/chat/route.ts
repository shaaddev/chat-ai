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
  const { id: clientId, messages }: { id: string; messages: Array<Message> } =
    await req.json();

  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  let chatId: string;
  let chat;

  // const chat = await getChatById({ id });

  if (clientId) {
    chat = await getChatById({ id: clientId });
  }

  if (!chat) {
    chatId = generateUUID();
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id: chatId, title });
  } else {
    chatId = chat.id;
  }

  await saveMessages({
    messages: [
      { ...userMessage, id: generateUUID(), createdAt: new Date(), chatId },
    ],
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
              id: generateUUID(),
              chatId,
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
