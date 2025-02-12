import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const id = generateUUID();

  return (
    <div className="flex flex-col min-h-screen w-full">
      <Chat
        id={id}
        // selectedChatModel={modelFromCookie.value}
        initialMessages={[]}
      />
    </div>
  );
}
