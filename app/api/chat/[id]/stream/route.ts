import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { differenceInSeconds } from "date-fns";
import { auth } from "@/app/auth";
import {
  canReadChat,
  getChatById,
  getLatestStreamId,
  getMessagesByChatId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { getStreamContext } from "../../route";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById(chatId);

  if (!chat) {
    return new ChatSDKError("not_found:chat").toResponse();
  }

  if (!canReadChat(chat, session.user.id)) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const recentStreamId = await getLatestStreamId(chatId);

  if (!recentStreamId) {
    return new ChatSDKError("not_found:stream").toResponse();
  }

  const emptyDataStream = createUIMessageStream<ChatMessage>({
    execute: () => {
      // Intentionally empty: used to keep the resumable SSE response shape valid.
    },
  });

  let stream;
  try {
    stream = await streamContext.resumableStream(recentStreamId, () =>
      emptyDataStream.pipeThrough(new JsonToSseTransformStream())
    );
  } catch (error) {
    console.error("Resumable stream error:", error);
    stream = null;
  }

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId(chatId);
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, {
        status: 200,
      });
    }

    if (mostRecentMessage.role !== "assistant") {
      return new Response(emptyDataStream, {
        status: 200,
      });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, {
        status: 200,
      });
    }

    const restoredStream = createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({
          type: "data-appendMessage",
          data: JSON.stringify(mostRecentMessage),
          transient: true,
        });
      },
    });

    return new Response(
      restoredStream.pipeThrough(new JsonToSseTransformStream()),
      {
        status: 200,
      }
    );
  }

  return new Response(stream, {
    status: 200,
  });
}
