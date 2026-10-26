import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { getDb } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";
import { sendOtpEmail } from "@/lib/email/resend";

// Better Auth 1.7 checks the Origin of every email-OTP request. In
// development, trust any loopback origin so other ports and *.localhost
// hosts can sign in. Production trusts only BETTER_AUTH_URL.
function isLoopback(origin: string) {
  if (!URL.canParse(origin)) {
    return false;
  }
  const { hostname } = new URL(origin);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    trustedOrigins: (request) => {
      const origin = request?.headers.get("origin");
      return process.env.NODE_ENV !== "production" &&
        origin &&
        isLoopback(origin)
        ? [origin]
        : [];
    },
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
