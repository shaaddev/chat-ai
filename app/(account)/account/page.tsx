import { redirect } from "next/navigation";
import { auth } from "@/app/auth";
import { Account } from "@/components/account/account";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  const { email, name, image } = session.user;

  return (
    <div className="w-full">
      <Account user={{ email, name, image: image ?? null }} />
    </div>
  );
}
