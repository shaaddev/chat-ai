import { Chat } from "@/components/chat";
import { notFound } from "next/navigation";
import { getChatById, getMessagesByChatId } from "@/db/queries";
import { convertToUIMessages } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
