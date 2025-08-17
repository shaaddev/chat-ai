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
  createStreamId,
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
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { after } from "next/server";
import { ChatSDKError } from "@/lib/errors";
import { postRequestBodySchema, type PostRequestBody } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  // Original code (uncomment when Redis is configured):
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
      console.log(" > Resumable streams enabled");
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error("Resumable stream context error:", error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(req: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await req.json();
    console.log("JSON", json);
    requestBody = postRequestBodySchema.parse(json);
    console.log("REQUEST BODY", requestBody);
  } catch (error) {
    console.log("ERROR", error);
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
    }: { id: string; message: ChatMessage; selectedChatModel: string } =
      requestBody;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

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

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        try {
          console.log("Starting stream execution for chat:", id);
          const res = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: systemPrompt({ selectedChatModel }),
            messages: convertToModelMessages(uiMessages),
            experimental_transform: smoothStream({ chunking: "word" }),
          });

          // Use the stream directly instead of merging
          for await (const chunk of res.toUIMessageStream()) {
            console.log("Writing chunk:", chunk.type);
            dataStream.write(chunk);
          }
          console.log("Stream execution completed for chat:", id);
        } catch (error) {
          console.error("Stream execution error:", error);
          dataStream.write({
            type: "error",
            errorText:
              "An error occurred while generating the response. Please try again.",
          });
        }
      },
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
      onError: () => {
        return "Oops, an error occurred";
      },
    });

    const streamContext = getStreamContext();

    // Since we're temporarily disabling resumable streams, always use regular streaming
    console.log("Using regular streaming for chat:", id);
    return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
