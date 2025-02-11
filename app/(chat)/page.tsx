import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { cookies } from "next/headers";

export default async function Page() {
  const id = generateUUID();

  const cookieStore = await cookies();
  const modelFromCookie = cookieStore.get("selected_model");

  if (!modelFromCookie) {
    return (
      <div className="flex flex-col min-h-screen w-full">
        <Chat
          id={id}
          selectedChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={[]}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full">
      <Chat
        id={id}
        selectedChatModel={modelFromCookie.value}
        initialMessages={[]}
      />
    </div>
  );
}
