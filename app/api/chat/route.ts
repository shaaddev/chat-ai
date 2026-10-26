import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  smoothStream,
  streamText,
  type ToolSet,
  toUIMessageStream,
  type UIMessageStreamWriter,
} from "ai";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { auth } from "@/app/auth";
import { type ChatModel, getChatModel } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import {
  CHAT_TITLE_MAX_LENGTH,
  generateChatTitle,
  getLanguageModel,
} from "@/lib/ai/providers";
import {
  createStreamId,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChat,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage, ChatMessageMetadata } from "@/lib/types";
import { utapi } from "@/lib/uploadthing/core";
import {
  convertToUIMessages,
  generateUUID,
  hasVisibleContent,
} from "@/lib/utils";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;
const DATA_URL_REGEX = /^data:(image\/[^;]+);base64,(.+)$/;
const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

function getUploadThingUrlFromResult(result: unknown): string | undefined {
  const extract = (obj: unknown): string | undefined => {
    if (!obj || typeof obj !== "object") {
      return undefined;
    }
    const rec = obj as Record<string, unknown>;
    const { data } = rec;
    if (data && typeof data === "object") {
      const drec = data as Record<string, unknown>;
      const ufs = drec.ufsUrl;
      if (typeof ufs === "string") {
        return ufs;
      }
      const { url } = drec;
      if (typeof url === "string") {
        return url;
      }
    }
    const ufs = rec.ufsUrl;
    if (typeof ufs === "string") {
      return ufs;
    }
    const { url } = rec;
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

function getStreamErrorText(error: unknown) {
  console.error("Stream execution error:", error);
  return "An error occurred while generating the response. Please try again.";
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

async function requestImage(slug: string, prompt: string): Promise<string> {
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "https://chat.shaaddev.com",
      "X-Title": "Chat AI - Shaad",
    },
    body: JSON.stringify({
      model: slug,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("OpenRouter image generation error:", errorData);

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    throw new Error(
      (errorData as { error?: { message?: string } })?.error?.message ||
        `OpenRouter API error: ${response.status}`
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
    const [imageData] = result.choices[0].images;
    if (typeof imageData === "string") {
      imageDataUrl = imageData.startsWith("data:")
        ? imageData
        : `data:image/png;base64,${imageData}`;
    } else if (imageData?.image_url?.url) {
      imageDataUrl = imageData.image_url.url;
    } else if (imageData?.b64_json || imageData?.base64 || imageData?.data) {
      const base64 = imageData.b64_json || imageData.base64 || imageData.data;
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

  return imageDataUrl;
}

async function uploadImage(bytes: Uint8Array<ArrayBuffer>, mediaType: string) {
  const extension = mediaType.split("/")[1] || "png";
  const file = new File([bytes], `image-${Date.now()}.${extension}`, {
    type: mediaType,
  });
  const url = getUploadThingUrlFromResult(await utapi.uploadFiles(file));
  if (!url) {
    throw new Error("Image generation produced no upload URL");
  }
  return { url, mediaType };
}

async function storeGeneratedImage(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const dataUrlMatch = imageUrl.match(DATA_URL_REGEX);
    if (!dataUrlMatch) {
      throw new Error("Invalid image data URL format");
    }
    const [, mediaType, base64] = dataUrlMatch;
    return await uploadImage(
      new Uint8Array(Buffer.from(base64, "base64")),
      mediaType
    );
  }

  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const mediaType = imageResponse.headers.get("content-type") || "image/png";
    return await uploadImage(
      new Uint8Array(await imageResponse.arrayBuffer()),
      mediaType
    );
  } catch (error) {
    console.error("Failed to download/upload external image:", error);
    return { url: imageUrl, mediaType: "image/png" };
  }
}

async function writeGeneratedImage(
  writer: UIMessageStreamWriter<ChatMessage>,
  {
    model,
    prompt,
    metadata,
  }: { model: ChatModel; prompt: string; metadata: ChatMessageMetadata }
) {
  try {
    const image = await storeGeneratedImage(
      await requestImage(model.slug, prompt)
    );
    writer.write({ type: "start", messageMetadata: metadata });
    writer.write({ type: "file", url: image.url, mediaType: image.mediaType });
    writer.write({ type: "finish" });
  } catch (error) {
    console.error("Image generation error:", error);
    writer.write({
      type: "error",
      errorText:
        "An error occurred while generating the image. Please try again.",
    });
  }
}

const TITLE_WAIT_MS = 3000;

// The client refreshes the sidebar when a stream ends, so a new chat's
// stream waits briefly for its title. A slow title still saves afterward.
async function waitForTitle(titleSaved: Promise<void> | undefined) {
  if (!titleSaved) {
    return;
  }
  await Promise.race([
    titleSaved,
    new Promise((resolve) => setTimeout(resolve, TITLE_WAIT_MS)),
  ]);
}

async function saveGeneratedTitle({
  chatId,
  userId,
  message,
}: {
  chatId: string;
  userId: string;
  message: ChatMessage;
}) {
  const title = await generateChatTitle(message);
  if (title) {
    await updateChat({ id: chatId, userId, changes: { title } });
  }
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
      selectedChatModel,
      useSearch,
      autoDocumentGeneration,
      customSystemPrompt,
    } = requestBody;
    const message: ChatMessage = requestBody.message;
    const model = getChatModel(selectedChatModel);

    const latestUserText = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim()
      .slice(0, 10_000);

    const session = await auth();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = session.user.id;

    const existingChat = await getChatById(id);
    if (existingChat && existingChat.userId !== userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    let titleSaved: Promise<void> | undefined;
    if (!existingChat) {
      await saveChat({
        id,
        userId,
        title: latestUserText.slice(0, CHAT_TITLE_MAX_LENGTH) || "New chat",
        systemPrompt: customSystemPrompt,
      });
      // A promise, not a callback: a callback would only start once the
      // reply has finished streaming, so the title would land after the
      // client's end-of-stream refresh.
      titleSaved = saveGeneratedTitle({ chatId: id, userId, message }).catch(
        (error) => console.error("Failed to save the chat title", error)
      );
      after(titleSaved);
    }

    const history = existingChat
      ? convertToUIMessages(await getMessagesByChatId(id))
      : [];

    await Promise.all([
      saveMessages(id, [
        { id: message.id, role: "user", parts: message.parts, model: null },
      ]),
      createStreamId({ streamId: generateUUID(), chatId: id }),
    ]);

    const documentIntent = detectDocumentIntent(
      latestUserText,
      autoDocumentGeneration
    );
    const metadata: ChatMessageMetadata = {
      model: model.id,
      useSearch,
      documentCandidate: documentIntent.documentCandidate,
      suggestedFormat: documentIntent.suggestedFormat,
    };

    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        if (model.kind === "image") {
          await writeGeneratedImage(writer, {
            model,
            prompt: latestUserText,
            metadata,
          });
          await waitForTitle(titleSaved);
          return;
        }

        const result = streamText({
          model: getLanguageModel(model.slug, { useWebSearch: useSearch }),
          instructions: systemPrompt({
            model,
            customSystemPrompt:
              customSystemPrompt ?? existingChat?.systemPrompt ?? undefined,
          }),
          messages: await convertToModelMessages([...history, message]),
          experimental_transform: smoothStream({ chunking: "word" }),
          stopWhen: isStepCount(5),
          maxOutputTokens: 5000,
        });

        writer.merge(
          toUIMessageStream<ToolSet, ChatMessage>({
            stream: result.stream,
            sendSources: true,
            onError: getStreamErrorText,
            messageMetadata: ({ part }) =>
              part.type === "start" ? metadata : undefined,
          })
        );
        await waitForTitle(titleSaved);
      },
      generateId: generateUUID,
      onEnd: async ({ responseMessage }) => {
        if (!hasVisibleContent(responseMessage)) {
          return;
        }
        try {
          await saveMessages(id, [
            {
              id: responseMessage.id,
              role: "assistant",
              parts: responseMessage.parts,
              model: model.id,
            },
          ]);
        } catch (error) {
          console.error("Failed to save the assistant message", error);
        }
      },
      onError: getStreamErrorText,
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
