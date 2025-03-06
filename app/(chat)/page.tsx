import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";
import { authClient } from "@/lib/auth/auth-client";

export default async function Page() {
  const id = generateUUID();
  const { data: session } = await authClient.getSession();

  return (
    <div className="flex flex-col min-h-screen w-full">
      <Chat
        id={id}
        // selectedChatModel={modelFromCookie.value}
        initialMessages={[]}
        user={session?.user}
      />
    </div>
  );
}
