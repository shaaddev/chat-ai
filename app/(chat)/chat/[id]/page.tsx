import { Chat } from "@/components/chat";
import { notFound } from "next/navigation";
import { getChatById, getMessagesByChatId } from "@/db/queries";
import { convertToUIMessages } from "@/lib/utils";
import { cookies } from "next/headers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const cookie = await cookies();
  const chatModelFromCookie = cookie.get("selected_model");

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          id={chat.id}
          selectedChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={convertToUIMessages(messagesFromDb)}
        />
      </>
    );
  }

  return (
    <>
      <Chat
        id={chat.id}
        selectedChatModel={chatModelFromCookie.value}
        initialMessages={convertToUIMessages(messagesFromDb)}
      />
    </>
  );
}
