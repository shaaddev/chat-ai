import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const base_url =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_URL
    : "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: base_url,
  plugins: [magicLinkClient(), emailOTPClient()],
});
