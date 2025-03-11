import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const id = generateUUID();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  console.log(session);

  return (
    <div className="flex flex-col min-h-screen w-full">
      <Chat id={id} initialMessages={[]} session={session} />
    </div>
  );
}
