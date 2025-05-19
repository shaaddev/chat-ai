import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Account } from "@/components/account/account";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const user_info = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id));

  const { email, name, image } = user_info[0];

  return (
    <div className="">
      <Account user_info={{ email, name, image }} />
    </div>
  );
}
