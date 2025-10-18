import { cookies, headers } from "next/headers";
import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { auth } from "@/lib/auth";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const id = generateUUID();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  if (!modelIdFromCookie) {
    return (
      <div className="flex flex-col min-h-screen w-full">
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
    <div className="flex flex-col min-h-screen w-full">
      <Chat
        id={id}
        initialChatModel={modelIdFromCookie.value}
        initialMessages={[]}
        session={session}
      />
    </div>
  );
}
