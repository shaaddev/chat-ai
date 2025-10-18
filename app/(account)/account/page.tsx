import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Account } from "@/components/account/account";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/app/auth";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  const user_info = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id));

  const { email, name, image } = user_info[0];

  return (
    <div className="w-full">
      <Account user={{ email, name, image }} />
    </div>
  );
}
