import {
  UIMessage,
  streamText,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
} from "ai";
import { systemPrompt } from "@/lib/ai/prompts";
import { saveChat, saveMessages, getChatById } from "@/db/queries";
import {
  getMostRecentUserMessage,
  generateUUID,
  getTrailingMessageId,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "@/app/actions";
import { myProvider, stable_models } from "@/lib/ai/models";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    id,
    messages,
    selectedChatModel,
  }: { id: string; messages: Array<UIMessage>; selectedChatModel: string } =
    await req.json();

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat && session) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  } else {
    if (chat.userId !== session?.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  await saveMessages({
    messages: [
      {
        ...userMessage,
        attachments: userMessage.experimental_attachments ?? [],
        createdAt: new Date(),
        chatId: id,
      },
    ],
  });

  const selectedModel = stable_models.find(
    (model) => model.id === selectedChatModel,
  );

  if (!selectedModel) {
    return new Response("Invalid model selected", { status: 400 });
  }

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
            const assistantId = getTrailingMessageId({
              messages: response.messages.filter(
                (message) => message.role === "assistant",
              ),
            });

            if (!assistantId) {
              throw new Error("No assistant message found!");
            }

            const [, assistantMessage] = appendResponseMessages({
              messages: [userMessage],
              responseMessages: response.messages,
            });

            await saveMessages({
              messages: [
                {
                  id: assistantId,
                  chatId: id,
                  role: assistantMessage.role,
                  content: assistantMessage.content,
                  attachments: assistantMessage.experimental_attachments ?? [],
                  createdAt: new Date(),
                },
              ],
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
