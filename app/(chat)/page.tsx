import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

export default function Page() {
  const id = generateUUID();

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
