import { DynamicChat } from "@/components/dynamic-chat";
import { notFound } from "next/navigation";
import { getChatById, getMessagesByChatId } from "@/db/queries";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { UIMessage } from "ai";
import type { Attachment } from "@/lib/types";
import { Message } from "@/db/schema";
import { cookies } from "next/headers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!chat && !session) {
    notFound();
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  function convertToUIMessages(messages: Array<Message>): Array<UIMessage> {
    return messages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage["parts"],
      role: message.role as UIMessage["role"],
      content: "",
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
    }));
  }

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  if (!modelIdFromCookie) {
    return (
      <div className="flex flex-col min-h-screen w-full">
        <DynamicChat
          id={chat.id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={convertToUIMessages(messagesFromDb)}
          session={session}
        />
      </div>
    );
  }
  return (
    <>
      <DynamicChat
        id={chat.id}
        initialChatModel={modelIdFromCookie.value}
        initialMessages={convertToUIMessages(messagesFromDb)}
        session={session}
      />
    </>
  );
}
