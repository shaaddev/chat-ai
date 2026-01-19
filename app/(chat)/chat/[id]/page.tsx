import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { getChatById, getMessagesByChatId } from "@/lib/convex/queries";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { auth } from "@/app/auth";
import { convertToUIMessages } from "@/lib/utils";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });
  const session = await auth();

  if (!chat) {
    notFound();
  }

  if (!session) {
    redirect("/");
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  if (!modelIdFromCookie) {
    return (
      <div className="flex flex-col min-h-screen w-full">
        <Chat
          id={chat.id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={uiMessages}
          session={session}
        />
      </div>
    );
  }
  return (
    <>
      <Chat
        id={chat.id}
        initialChatModel={modelIdFromCookie.value}
        initialMessages={uiMessages}
        session={session}
      />
    </>
  );
}
