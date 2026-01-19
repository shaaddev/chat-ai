import { redirect } from "next/navigation";
import { Account } from "@/components/account/account";
import { convex, api } from "@/lib/convex/server";
import { auth } from "@/app/auth";
import type { Id } from "@/convex/_generated/dataModel";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  const user = await convex.query(api.users.getById, {
    id: session.user.id as Id<"users">,
  });

  if (!user) {
    redirect("/");
  }

  const { email, name, image } = user;

  return (
    <div className="w-full">
      <Account user={{ email, name, image }} />
    </div>
  );
}
