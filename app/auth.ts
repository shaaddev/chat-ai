import { headers } from "next/headers";
import { cache } from "react";
import { getAuth, type Session } from "@/lib/auth";

export type { Session } from "@/lib/auth";

// The (chat) layout and its page both ask for the session in one request.
export const auth = cache(async (): Promise<Session | null> => {
  const requestHeaders = await headers();
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result) {
    return null;
  }
  const { id, email, name, image } = result.user;
  return { user: { id, email, name, image } };
});
