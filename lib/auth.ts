import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { getDb } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { sendOtpEmail } from "@/lib/email/resend";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    trustedOrigins: ["http://localhost:3000", "https://chat.shaaddev.com"],
    plugins: [
      emailOTP({
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 300,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type === "sign-in" || type === "email-verification") {
            await sendOtpEmail(email, otp);
          }
        },
      }),
      nextCookies(),
    ],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

// betterAuth() starts initializing as soon as it is called and rejects
// without BETTER_AUTH_SECRET, so build only on the first request.
export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
}
