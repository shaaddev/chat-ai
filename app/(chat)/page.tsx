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

  if (!modelIdFromCookie) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <Chat
          id={id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={[]}
          session={session}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Chat
        id={id}
        initialChatModel={modelIdFromCookie.value}
        initialMessages={[]}
        session={session}
      />
    </div>
  );
}
