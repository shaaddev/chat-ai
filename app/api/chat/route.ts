import {
  type Message,
  streamText,
  createDataStreamResponse,
  smoothStream,
} from "ai";
import { systemPrompt } from "@/lib/ai/prompts";
import { saveChat, saveMessages, getChatById } from "@/db/queries";
import {
  getMostRecentUserMessage,
  sanitizeResponseMessages,
  generateUUID,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "@/app/actions";
import { myProvider } from "@/lib/ai/models";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    id,
    messages,
    selectedChatModel,
  }: { id: string; messages: Array<Message>; selectedChatModel: string } =
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

  return createDataStreamResponse({
    execute: (dataStream) => {
      const res = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: systemPrompt({ selectedChatModel }),
        messages,
        maxSteps: 5,
        experimental_transform: smoothStream({ chunking: "word" }),
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
            console.error("Failed to save chat", error);
          }
        },
      });

      res.mergeIntoDataStream(dataStream);
    },
    onError: () => {
      return "Oops, an error occurred";
    },
  });
}
