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
import { myProvider, stable_models, image_models } from "@/lib/ai/models";
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
import type { LanguageModelUsage } from "ai";
import { getToolsForModel } from "@/lib/ai/tools";
import { experimental_generateImage } from "ai";
import { utapi } from "@/lib/uploadthing/core";
import fs from "fs";

export const maxDuration = 60;

function getUploadThingUrlFromResult(result: unknown): string | undefined {
  const extract = (obj: unknown): string | undefined => {
    if (!obj || typeof obj !== "object") return undefined;
    const rec = obj as Record<string, unknown>;
    const data = rec["data"];
    if (data && typeof data === "object") {
      const drec = data as Record<string, unknown>;
      const ufs = drec["ufsUrl"];
      if (typeof ufs === "string") return ufs;
      const url = drec["url"];
      if (typeof url === "string") return url;
    }
    const ufs = rec["ufsUrl"];
    if (typeof ufs === "string") return ufs;
    const url = rec["url"];
    if (typeof url === "string") return url;
    return undefined;
  };

  if (Array.isArray(result)) {
    for (const item of result) {
      const found = extract(item);
      if (found) return found;
    }
    return undefined;
  }
  return extract(result);
}

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
          " > Resumable streams are disabled due to missing REDIS_URL",
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
      useSearch,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: string;
      useSearch: boolean;
    } = requestBody;

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
          model: null,
        },
      ],
    });

    const selectedModel =
      stable_models.find((model) => model.id === selectedChatModel) ||
      image_models.find((model) => model.id === selectedChatModel);

    if (!selectedModel) {
      return new Response("Invalid model selected", { status: 400 });
    }

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Fallback holder when using image models: if the streaming collector
    // doesn't capture our appended assistant message, persist this manually.
    let fallbackImageAssistantMessage: {
      id: string;
      parts: Array<{
        type: "file";
        mediaType: string;
        name: string;
        url: string;
      }>;
    } | null = null;

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        try {
          const isImageModel = image_models.some(
            (m) => m.id === selectedChatModel,
          );

          if (isImageModel) {
            // Generate an image using the selected image model
            const latestUserText = message.parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("\n")
              .slice(0, 2000);

            try {
              const { image } = await experimental_generateImage({
                model: myProvider.imageModel(selectedChatModel),
                prompt: latestUserText,
              });

              // Try to determine a usable URL for the image
              const fileName = `image-${Date.now()}.png`;
              // Decode base64 and write to disk
              fs.writeFileSync(fileName, Buffer.from(image.base64, "base64"));
              const assistantMessageId = generateUUID();

              const mediaType = "image/png";
              // Upload the same file we just wrote to UploadThing
              let uploadedUrl: string | undefined;
              try {
                const buffer = await fs.promises.readFile(fileName);
                const uint8 = new Uint8Array(buffer);
                const file = new File([uint8], fileName, { type: mediaType });
                const uploadRes = await utapi.uploadFiles(file);
                uploadedUrl = getUploadThingUrlFromResult(uploadRes);
              } catch (uploadErr) {
                console.error("UploadThing upload failed:", uploadErr);
              } finally {
                // Best-effort cleanup of the temp file
                try {
                  await fs.promises.unlink(fileName);
                } catch {}
              }

              if (!uploadedUrl) {
                throw new Error("Image generation produced no upload URL");
              }

              // Append assistant message with the generated image as a file part
              const messageData = {
                id: assistantMessageId,
                role: "assistant",
                parts: [
                  {
                    type: "file",
                    mediaType: mediaType,
                    name: "generated-image",
                    url: uploadedUrl,
                  },
                ],
              };

              dataStream.write({
                type: "data-appendMessage",
                data: JSON.stringify(messageData),
              });

              // Store fallback in case onFinish messages don't include it
              fallbackImageAssistantMessage = {
                id: assistantMessageId,
                parts: [
                  {
                    type: "file" as const,
                    mediaType,
                    name: "generated-image",
                    url: uploadedUrl,
                  },
                ],
              };

              // Attach model metadata (no usage tokens for image gen)
              dataStream.write({
                type: "data-setMessageMetadata",
                data: JSON.stringify({
                  id: assistantMessageId,
                  metadata: { model: selectedChatModel, useSearch },
                }),
              });
            } catch (err) {
              console.error("Image generation error:", err);
              dataStream.write({
                type: "error",
                errorText:
                  "An error occurred while generating the image. Please try again.",
              });
            }
          } else {
            const res = streamText({
              model: myProvider.languageModel(selectedChatModel),
              system: systemPrompt({ selectedChatModel }),
              tools: useSearch
                ? getToolsForModel(selectedChatModel)
                : undefined,
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
                chunk?.type === "data-appendMessage"
              ) {
                try {
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
              const usage: LanguageModelUsage = await res.usage;
              const outputTokens = usage.outputTokens;

              if (assistantMessageId) {
                dataStream.write({
                  type: "data-setMessageMetadata",
                  data: JSON.stringify({
                    id: assistantMessageId,
                    metadata: {
                      usage: { outputTokens },
                      outputTokens,
                      model: selectedChatModel,
                      useSearch,
                    },
                  }),
                });
              }
            } catch (err) {
              console.error("Failed to attach token usage metadata:", err);
            }
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
          const toSave = messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
            chatId: id,
            model: message.role === "assistant" ? selectedChatModel : null,
          }));

          // If the image assistant message wasn't captured, persist it explicitly
          if (fallbackImageAssistantMessage) {
            const alreadyIncluded = toSave.some(
              (m) => m.id === fallbackImageAssistantMessage!.id,
            );

            if (!alreadyIncluded) {
              toSave.push({
                id: fallbackImageAssistantMessage.id,
                role: "assistant",
                parts:
                  fallbackImageAssistantMessage.parts as unknown as (typeof toSave)[number]["parts"],
                attachments: [],
                createdAt: new Date(),
                chatId: id,
                model: selectedChatModel,
              });
            }
          }

          await saveMessages({ messages: toSave });
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
    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
