import fs from "node:fs";
import type { LanguageModelUsage } from "ai";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { generateTitleFromUserMessage } from "@/app/actions";
import { auth } from "@/app/auth";
import { image_models, myProvider, stable_models } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { getToolsForModel } from "@/lib/ai/tools";
import {
  createStreamId,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitle,
} from "@/lib/convex/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { utapi } from "@/lib/uploadthing/core";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;
const DATA_URL_REGEX = /^data:(image\/[^;]+);base64,(.+)$/;

// Note: For App Router, body size limits are handled at the platform level
// (e.g., Vercel.json or reverse proxy configuration)
// Default limit is typically 4.5MB which should be sufficient for text-based chat

function getUploadThingUrlFromResult(result: unknown): string | undefined {
  const extract = (obj: unknown): string | undefined => {
    if (!obj || typeof obj !== "object") {
      return undefined;
    }
    const rec = obj as Record<string, unknown>;
    const data = rec.data;
    if (data && typeof data === "object") {
      const drec = data as Record<string, unknown>;
      const ufs = drec.ufsUrl;
      if (typeof ufs === "string") {
        return ufs;
      }
      const url = drec.url;
      if (typeof url === "string") {
        return url;
      }
    }
    const ufs = rec.ufsUrl;
    if (typeof ufs === "string") {
      return ufs;
    }
    const url = rec.url;
    if (typeof url === "string") {
      return url;
    }
    return undefined;
  };

  if (Array.isArray(result)) {
    for (const item of result) {
      const found = extract(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  return extract(result);
}

function detectDocumentIntent(
  text: string,
  autoDocumentGeneration: boolean
): { documentCandidate: boolean; suggestedFormat: "docx" | "pdf" } {
  if (!autoDocumentGeneration) {
    return { documentCandidate: false, suggestedFormat: "docx" };
  }

  const normalized = text.toLowerCase();
  const docHints = [
    "document",
    "doc",
    "docx",
    "pdf",
    "letter",
    "report",
    "invoice",
    "proposal",
    "summary",
    "contract",
    "resume",
    "cv",
    "minutes",
    "plan",
    "memo",
  ];

  const documentCandidate = docHints.some((hint) => normalized.includes(hint));
  const suggestedFormat: "docx" | "pdf" =
    normalized.includes("pdf") && !normalized.includes("docx") ? "pdf" : "docx";

  return { documentCandidate, suggestedFormat };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function cleanupTempFile(fileName: string) {
  try {
    await fs.promises.unlink(fileName);
  } catch {
    // Ignore temp file cleanup failures.
  }
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error) {
      if (!getErrorMessage(error).includes("REDIS_URL")) {
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
  } catch {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      useSearch,
      autoDocumentGeneration,
      customSystemPrompt,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: string;
      useSearch: boolean;
      autoDocumentGeneration: boolean;
      customSystemPrompt?: string;
    } = requestBody;

    const latestUserText = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim()
      .slice(0, 10_000);

    const documentIntent = detectDocumentIntent(
      latestUserText,
      autoDocumentGeneration
    );

    const session = await auth();

    const existingChat = await getChatById({ id });

    if (!existingChat && session) {
      const title = await generateTitleFromUserMessage({ message });
      await saveChat({
        id,
        userId: session.user.id,
        title,
        systemPrompt: customSystemPrompt,
      });
    } else if (existingChat) {
      if (existingChat.userId !== session?.user.id) {
        return new Response("Unauthorized", { status: 401 });
      }
      // Update the chat title if it's still the default "New chat" title
      if (
        existingChat.title === "New chat" ||
        existingChat.title === message.parts[0].type.slice(0, 80)
      ) {
        const title = await generateTitleFromUserMessage({ message });
        await updateChatTitle({ id, title });
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
            (m) => m.id === selectedChatModel
          );

          if (isImageModel) {
            const latestUserText = message.parts
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("\n")
              .trim()
              .slice(0, 10_000);

            try {
              const response = await fetch(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer":
                      process.env.NEXT_PUBLIC_APP_URL ||
                      "https://chat.shaaddev.com",
                    "X-Title": "Chat AI - Shaad",
                  },
                  body: JSON.stringify({
                    model: myProvider.imageModel(selectedChatModel),
                    messages: [
                      {
                        role: "user",
                        content: latestUserText,
                      },
                    ],
                    modalities: ["image", "text"],
                  }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("OpenRouter image generation error:", errorData);

                if (response.status === 429) {
                  throw new Error(
                    "Rate limit exceeded. Please try again later."
                  );
                }

                throw new Error(
                  (errorData as { error?: { message?: string } })?.error
                    ?.message || `OpenRouter API error: ${response.status}`
                );
              }

              const result = await response.json();
              const resultMessage = result.choices?.[0]?.message;
              let imageDataUrl: string | null = null;

              if (resultMessage?.images?.[0]?.image_url?.url) {
                imageDataUrl = resultMessage.images[0].image_url.url;
              } else if (result.data?.[0]?.b64_json) {
                imageDataUrl = `data:image/png;base64,${result.data[0].b64_json}`;
              } else if (result.choices?.[0]?.images?.[0]) {
                const imageData = result.choices[0].images[0];
                if (typeof imageData === "string") {
                  imageDataUrl = imageData.startsWith("data:")
                    ? imageData
                    : `data:image/png;base64,${imageData}`;
                } else if (imageData?.image_url?.url) {
                  imageDataUrl = imageData.image_url.url;
                } else if (
                  imageData?.b64_json ||
                  imageData?.base64 ||
                  imageData?.data
                ) {
                  const base64 =
                    imageData.b64_json || imageData.base64 || imageData.data;
                  imageDataUrl = `data:image/png;base64,${base64}`;
                }
              } else if (Array.isArray(resultMessage?.content)) {
                for (const part of resultMessage.content) {
                  if (part.inline_data?.data) {
                    const mimeType = part.inline_data.mime_type || "image/png";
                    imageDataUrl = `data:${mimeType};base64,${part.inline_data.data}`;
                    break;
                  }
                  if (part.image_url?.url) {
                    imageDataUrl = part.image_url.url;
                    break;
                  }
                  if (part?.type === "image_url" && part?.image_url?.url) {
                    imageDataUrl = part.image_url.url;
                    break;
                  }
                }
              } else if (
                typeof resultMessage?.content === "string" &&
                resultMessage.content.startsWith("data:image")
              ) {
                imageDataUrl = resultMessage.content;
              }

              if (!imageDataUrl) {
                console.error(
                  "No image data found in response:",
                  JSON.stringify(result, null, 2)
                );
                throw new Error("No image was generated");
              }

              const assistantMessageId = generateUUID();
              let uploadedUrl: string | undefined;

              if (imageDataUrl.startsWith("data:")) {
                const dataUrlMatch = imageDataUrl.match(DATA_URL_REGEX);
                if (!dataUrlMatch) {
                  throw new Error("Invalid image data URL format");
                }

                const mimeType = dataUrlMatch[1];
                const imageBase64 = dataUrlMatch[2];
                const extension = mimeType.split("/")[1] || "png";
                const fileName = `image-${Date.now()}.${extension}`;

                try {
                  fs.writeFileSync(
                    fileName,
                    Buffer.from(imageBase64, "base64")
                  );
                  const buffer = await fs.promises.readFile(fileName);
                  const uint8 = new Uint8Array(buffer);
                  const file = new File([uint8], fileName, { type: mimeType });
                  const uploadRes = await utapi.uploadFiles(file);
                  uploadedUrl = getUploadThingUrlFromResult(uploadRes);
                } catch (uploadErr) {
                  console.error("UploadThing upload failed:", uploadErr);
                } finally {
                  await cleanupTempFile(fileName);
                }
              } else {
                try {
                  const imageResponse = await fetch(imageDataUrl);
                  if (!imageResponse.ok) {
                    throw new Error(
                      `Failed to fetch image: ${imageResponse.status}`
                    );
                  }

                  const contentType =
                    imageResponse.headers.get("content-type") || "image/png";
                  const extension = contentType.split("/")[1] || "png";
                  const fileName = `image-${Date.now()}.${extension}`;
                  const arrayBuffer = await imageResponse.arrayBuffer();
                  const uint8 = new Uint8Array(arrayBuffer);

                  // Write to temp file and upload
                  fs.writeFileSync(fileName, Buffer.from(uint8));
                  const file = new File([uint8], fileName, {
                    type: contentType,
                  });
                  const uploadRes = await utapi.uploadFiles(file);
                  uploadedUrl = getUploadThingUrlFromResult(uploadRes);
                  await cleanupTempFile(fileName);
                } catch (downloadErr) {
                  console.error(
                    "Failed to download/upload external image:",
                    downloadErr
                  );
                  uploadedUrl = imageDataUrl;
                }
              }

              if (!uploadedUrl) {
                throw new Error("Image generation produced no upload URL");
              }

              const mediaType = "image/png";

              const messageData = {
                id: assistantMessageId,
                role: "assistant",
                parts: [
                  {
                    type: "file",
                    mediaType,
                    name: "generated-image",
                    url: uploadedUrl,
                  },
                ],
              };

              dataStream.write({
                type: "data-appendMessage",
                data: JSON.stringify(messageData),
              });

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

              dataStream.write({
                type: "data-setMessageMetadata",
                data: JSON.stringify({
                  id: assistantMessageId,
                  metadata: {
                    model: selectedChatModel,
                    useSearch,
                    documentCandidate: documentIntent.documentCandidate,
                    suggestedFormat: documentIntent.suggestedFormat,
                  },
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
            // Use custom system prompt if set, otherwise fall back to existing chat's prompt or default
            const effectiveSystemPrompt =
              customSystemPrompt ?? existingChat?.systemPrompt ?? undefined;

            const res = streamText({
              model: myProvider.languageModel(selectedChatModel),
              system: systemPrompt({
                selectedChatModel,
                customSystemPrompt: effectiveSystemPrompt,
              }),
              tools: useSearch
                ? getToolsForModel(selectedChatModel)
                : undefined,
              messages: await convertToModelMessages(uiMessages),
              experimental_transform: smoothStream({ chunking: "word" }),
              stopWhen: stepCountIs(5),
              maxOutputTokens: 5000,
            });

            let assistantMessageId: string | null = null;
            for await (const chunk of res.toUIMessageStream()) {
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
                  // Ignore malformed chunk metadata.
                }
              }

              dataStream.write(chunk);
            }

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
                      documentCandidate: documentIntent.documentCandidate,
                      suggestedFormat: documentIntent.suggestedFormat,
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

          if (fallbackImageAssistantMessage) {
            const persistedImageMessage = fallbackImageAssistantMessage;
            const alreadyIncluded = toSave.some(
              (savedMessage) => savedMessage.id === persistedImageMessage.id
            );

            if (!alreadyIncluded) {
              toSave.push({
                id: persistedImageMessage.id,
                role: "assistant",
                parts:
                  persistedImageMessage.parts as unknown as (typeof toSave)[number]["parts"],
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
    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
