import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { emailOTP, magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/db/schema";
import { otp_message, magic_link_message } from "./email/resend";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "sign-in") {
          // add resend action here
          await otp_message(email, otp);
        }
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await magic_link_message(email, url);
      },
      disableSignUp: true,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
