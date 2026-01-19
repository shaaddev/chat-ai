import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;
const convexSiteUrl = process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const internalSecret = process.env.INTERNAL_SECRET;

// Helper to call internal email endpoints
async function sendEmailViaInternal(
  endpoint: string,
  data: Record<string, string>
) {
  if (!convexSiteUrl || !internalSecret) {
    console.error("CONVEX_SITE_URL or INTERNAL_SECRET not configured");
    return;
  }

  const response = await fetch(`${convexSiteUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    console.error("Failed to send email:", await response.text());
  }
}

// The component client has methods needed for integrating Convex with Better Auth
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins: [
      "http://localhost:3000",
      "https://chat.shaaddev.com",
      siteUrl,
    ],
    plugins: [
      convex({ authConfig }),
      magicLink({
        disableSignUp: false,
        sendMagicLink: async ({ email, url }) => {
          await sendEmailViaInternal("/internal/send-magic-link-email", {
            to: email,
            link: url,
          });
        },
      }),
      emailOTP({
        disableSignUp: false,
        otpLength: 6,
        expiresIn: 300,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type === "sign-in" || type === "email-verification") {
            await sendEmailViaInternal("/internal/send-otp-email", {
              to: email,
              otp,
            });
          }
        },
      }),
    ],
  });
};

// Get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
