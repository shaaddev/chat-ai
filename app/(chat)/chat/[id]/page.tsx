import { Chat } from "@/components/chat";
import { notFound } from "next/navigation";
import { getChatById, getMessagesByChatId } from "@/db/queries";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Attachment, UIMessage } from "ai";
import { Message } from "@/db/schema";

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

  if (chat.visibility === "private") {
    if (!session || !session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
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

  return (
    <>
      <Chat
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        session={session}
      />
    </>
  );
}
