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
import { db } from "@/db";
import { chat } from "@/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: { id: string; messages: Array<UIMessage>; selectedChatModel: string } =
      await req.json();

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const message = getMostRecentUserMessage(messages);

    if (!message) {
      return new Response("No user message found", { status: 400 });
    }

    const existingChat = await getChatById({ id });

    if (!existingChat && session) {
      const title = await generateTitleFromUserMessage({ message: message });
      await saveChat({ id, userId: session.user.id, title });
    } else if (existingChat) {
      if (existingChat.userId !== session?.user.id) {
        return new Response("Unauthorized", { status: 401 });
      }
      // Update the chat title if it's still the default "New chat" title
      if (
        existingChat.title === "New chat" ||
        existingChat.title === message.content?.slice(0, 80)
      ) {
        const title = await generateTitleFromUserMessage({ message: message });
        await db
          .update(chat)
          .set({ title, updatedAt: new Date() })
          .where(eq(chat.id, id));
      }
    } else if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: message.experimental_attachments ?? [],
          createdAt: new Date(),
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
                messages: [message],
                responseMessages: response.messages,
              });

              await saveMessages({
                messages: [
                  {
                    id: assistantId,
                    chatId: id,
                    role: assistantMessage.role,
                    parts: assistantMessage.parts,
                    attachments:
                      assistantMessage.experimental_attachments ?? [],
                    createdAt: new Date(),
                  },
                ],
              });
            } catch (error) {
              console.error("Failed to save chat", error);
            }
          },
        });
        res.consumeStream();

        res.mergeIntoDataStream(dataStream);
      },
      onError: () => {
        return "Oops, an error occurred";
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
