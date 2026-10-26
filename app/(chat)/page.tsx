import { cookies } from "next/headers";
import { auth } from "@/app/auth";
import { FreshChat } from "@/components/fresh-chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const session = await auth();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  // New chat on `/` makes the router render this page again, and each render
  // is a new visit.
  return (
    <FreshChat
      initialChatModel={modelIdFromCookie?.value ?? DEFAULT_CHAT_MODEL}
      key={generateUUID()}
      session={session}
    />
  );
}
