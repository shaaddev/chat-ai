import { cookies } from "next/headers";
import { auth } from "@/app/auth";
import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const id = generateUUID();
  const session = await auth();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  return (
    <Chat
      id={id}
      initialChatModel={modelIdFromCookie?.value ?? DEFAULT_CHAT_MODEL}
      initialMessages={[]}
      key={id}
      session={session}
    />
  );
}
