import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/db/schema";
import { otp_message } from "../email/resend";

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
    nextCookies(),
  ],
  // disableSignUp: true,
});
