import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { email_otp_message, magic_link_message } from "./email/resend";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await magic_link_message(email, url);
      },
      disableSignUp: true,
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === "sign-in") {
          await email_otp_message(email, otp);
        }
      },
      disableSignUp: true,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
