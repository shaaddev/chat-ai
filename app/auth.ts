import { headers } from "next/headers";
import { auth as betterAuth } from "@/lib/auth";

export const auth = async () => {
  return await betterAuth.api.getSession({
    headers: await headers(),
  });
};
