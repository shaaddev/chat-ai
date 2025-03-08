import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";
// import { auth } from "@/lib/auth/auth";
// import { headers } from "next/headers";
// import { LoginDialog } from "@/components/auth/login-dialog";

export default async function Page() {
  const id = generateUUID();
  // const session = await auth.api.getSession({
  //   headers: await headers(),
  // });

  // console.log(session);

  // if (!session) {
  //   return (
  //     <div className="flex flex-col items-center justify-center min-h-screen">
  //       <LoginDialog />
  //     </div>
  //   );
  // }

  return (
    <div className="flex flex-col min-h-screen w-full">
      <Chat
        id={id}
        // selectedChatModel={modelFromCookie.value}
        initialMessages={[]}
        // user={session.user}
      />
    </div>
  );
}
