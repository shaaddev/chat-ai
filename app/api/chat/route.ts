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
import { generateUUID, convertToUIMessages } from "@/lib/utils";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    requestBody = postRequestBodySchema.parse(json);
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
          const res = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: systemPrompt({ selectedChatModel }),
            messages: convertToModelMessages(uiMessages),
            experimental_transform: smoothStream({ chunking: "word" }),
            stopWhen: stepCountIs(5),
          });

          // Forward chunks, while capturing assistant message id for later metadata
          let assistantMessageId: string | null = null;
          for await (const chunk of res.toUIMessageStream()) {
            // Capture the assistant message id from the first append of assistant message
            if (
              assistantMessageId === null &&
              // @ts-ignore - chunk is a UI message stream event
              chunk?.type === "data-appendMessage"
            ) {
              try {
                // @ts-ignore - data is a JSON string of the message
                const appended = JSON.parse(chunk.data as string);
                if (
                  appended?.role === "assistant" &&
                  typeof appended?.id === "string"
                ) {
                  assistantMessageId = appended.id;
                }
              } catch {
                // ignore parse failures
              }
            }

            dataStream.write(chunk);
          }

          // After streaming completes, attempt to read token usage and attach to assistant metadata
          try {
            const anyRes = res as unknown as {
              response?: Promise<any>;
              usage?: any;
            };
            let usage: any = undefined;
            if (
              anyRes?.response &&
              typeof anyRes.response.then === "function"
            ) {
              try {
                const final = await anyRes.response;
                usage = final?.usage ?? usage;
              } catch {
                // ignore
              }
            }
            if (!usage && anyRes?.usage) {
              usage = anyRes.usage;
            }

            let totalTokens: number | undefined = undefined;
            if (usage && typeof usage === "object") {
              const u = usage as Record<string, unknown>;
              const inputTokens =
                (u.inputTokens as number) ?? (u.input_tokens as number);
              const outputTokens =
                (u.outputTokens as number) ?? (u.output_tokens as number);
              const total =
                (u.totalTokens as number) ?? (u.total_tokens as number);
              if (typeof total === "number") {
                totalTokens = total;
              } else if (
                typeof inputTokens === "number" &&
                typeof outputTokens === "number"
              ) {
                totalTokens = inputTokens + outputTokens;
              }
            }

            if (assistantMessageId && typeof totalTokens === "number") {
              dataStream.write({
                type: "data-setMessageMetadata",
                data: JSON.stringify({
                  id: assistantMessageId,
                  metadata: {
                    usage: { totalTokens },
                    totalTokens,
                  },
                }),
              });
            }
          } catch (err) {
            console.error("Failed to attach token usage metadata:", err);
          }
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

    // const streamContext = getStreamContext();

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
