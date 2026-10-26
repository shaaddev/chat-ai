import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/auth";
import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  canReadChat,
  getChatById,
  getMessagesByChatId,
} from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  const chat = await getChatById(id);

  if (!(chat && canReadChat(chat, session.user.id))) {
    notFound();
  }

  const uiMessages = convertToUIMessages(await getMessagesByChatId(id));
  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  return (
    <Chat
      id={chat.id}
      initialChatModel={modelIdFromCookie?.value ?? DEFAULT_CHAT_MODEL}
      initialMessages={uiMessages}
      initialSystemPrompt={chat.systemPrompt ?? undefined}
      initialTitle={chat.title}
      session={session}
    />
  );
}
