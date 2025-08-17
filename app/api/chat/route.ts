import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  smoothStream,
  JsonToSseTransformStream,
  stepCountIs,
} from "ai";
import { ChatMessage } from "@/lib/types";
import { systemPrompt } from "@/lib/ai/prompts";
import {
  saveChat,
  saveMessages,
  getChatById,
  getMessagesByChatId,
} from "@/db/queries";
import {
  getMostRecentUserMessage,
  generateUUID,
  convertToUIMessages,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "@/app/actions";
import { myProvider, stable_models } from "@/lib/ai/models";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chat } from "@/db/schema";
import { eq } from "drizzle-orm";
// import {
//   createResumableStreamContext,
//   type ResumableStreamContext,
// } from "resumable-stream";
// import { after } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: { id: string; messages: Array<ChatMessage>; selectedChatModel: string } =
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
        existingChat.title === message.parts[0].type.slice(0, 80)
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

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const selectedModel = stable_models.find(
      (model) => model.id === selectedChatModel
    );

    if (!selectedModel) {
      return new Response("Invalid model selected", { status: 400 });
    }

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const res = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_transform: smoothStream({ chunking: "word" }),
          generateId: generateUUID,
          onFinish: async ({ messages }) => {
            try {
              await saveMessages({
                messages: messages.map((message) => ({
                  id: message.id,
                  role: message.role,
                  parts: message.parts,
                  attachments: [],
                  createdAt: new Date(),
                  chatId: id,
                })),
              });
            } catch (error) {
              console.error("Failed to save chat", error);
            }
          },
        });
        res.consumeStream();

        dataStream.merge(res.toUIMessageStream());
      },
      onError: () => {
        return "Oops, an error occurred";
      },
    });

    // const streamContext = getStreamContext();

    // if (streamContext) {
    //   return new Response(
    //     await streamContext.resumableStream(streamId, () =>
    //       stream.pipeThrough(new JsonToSseTransformStream())
    //     )
    //   );
    // } else {
    //   return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    // }
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
