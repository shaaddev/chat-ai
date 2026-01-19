import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;
const resendApiKey = process.env.RESEND_API_KEY;

// Helper to send emails via Resend REST API (Convex-compatible)
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resendApiKey) {
    console.error("Resend API key not configured");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "chat <chat@shaaddev.com>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to send email:", error);
  }
}

// Email templates as HTML strings
function getOtpEmailHtml(email: string, otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px;">
        <div style="border: 1px solid #000; background-color: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; padding: 20px 24px; max-width: 480px; margin: 0 auto;">
          <div style="text-align: center;">
            <p style="font-size: 18px; font-weight: 500; margin: 0 0 16px 0;">
              Your verification code for <strong>Chat - Shaaddev</strong>
            </p>
          </div>
          <div>
            <p style="font-size: 14px; margin: 0 0 8px 0;">Hello ${email},</p>
            <p style="font-size: 14px; margin: 0 0 16px 0;">
              Use the one-time password (OTP) below to complete your sign in:
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="letter-spacing: 8px; font-size: 32px; font-weight: bold; font-family: monospace; background-color: #e5e5e5; color: #000; border-radius: 12px; padding: 12px 24px; display: inline-block;">
                ${otp}
              </span>
            </div>
            <p style="font-size: 12px; text-align: center; color: #8898aa; margin: 16px 0 0 0;">
              This code expires in 5 minutes. If you didn't request it, you can ignore this email.
            </p>
          </div>
          <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
          <p style="color: #8898aa; font-size: 12px; text-align: center; margin: 0;">
            For your security, never share this code with anyone.
          </p>
        </div>
      </body>
    </html>
  `;
}

function getMagicLinkEmailHtml(email: string, link: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px;">
        <div style="border: 1px solid #000; background-color: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; padding: 20px 24px; max-width: 480px; margin: 0 auto;">
          <div style="text-align: center;">
            <p style="font-size: 18px; font-weight: 500; margin: 0 0 16px 0;">
              Verify your email to sign-in to <strong>Chat - Shaaddev</strong>
            </p>
          </div>
          <div>
            <p style="font-size: 14px; margin: 0 0 8px 0;">Hello ${email},</p>
            <p style="font-size: 14px; margin: 0 0 8px 0;">We have received a sign-in attempt.</p>
            <p style="font-size: 14px; margin: 0 0 24px 0;">To complete the sign-in process, click the button below:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="font-size: 16px; font-weight: bold; border-radius: 12px; padding: 12px 24px; background-color: #171717; color: #fff; text-decoration: none; display: inline-block;">
                Open Chat
              </a>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
          <p style="color: #8898aa; font-size: 12px; text-align: center; margin: 0;">
            If you didn't attempt to sign-in but received this email, please ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
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
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
      magicLink({
        disableSignUp: false,
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({
            to: email,
            subject: "Magic Link Verification",
            html: getMagicLinkEmailHtml(email, url),
          });
        },
      }),
      emailOTP({
        disableSignUp: false,
        otpLength: 6,
        expiresIn: 300, // 5 minutes
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type === "sign-in" || type === "email-verification") {
            await sendEmail({
              to: email,
              subject: "One-Time Password Verification",
              html: getOtpEmailHtml(email, otp),
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
