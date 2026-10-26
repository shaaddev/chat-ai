import { headers } from "next/headers";
import { getAuth, type Session } from "@/lib/auth";

export type { Session } from "@/lib/auth";

export async function auth(): Promise<Session | null> {
  const requestHeaders = await headers();
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result) {
    return null;
  }
  const { id, email, name, image } = result.user;
  return { user: { id, email, name, image } };
}
