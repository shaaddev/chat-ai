import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { internal } from "./_generated/api";

const http = httpRouter();

// Register Better Auth routes
authComponent.registerRoutes(http, createAuth);

// Internal endpoint for sending OTP emails (called from auth callbacks)
http.route({
  path: "/internal/send-otp-email",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Verify internal secret
    const secret = req.headers.get("x-internal-secret");
    if (secret !== process.env.INTERNAL_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { to, otp } = await req.json();

    await ctx.runAction(internal.emails.sendOtpEmail, { to, otp });

    return new Response("OK", { status: 200 });
  }),
});

// Internal endpoint for sending magic link emails (called from auth callbacks)
http.route({
  path: "/internal/send-magic-link-email",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Verify internal secret
    const secret = req.headers.get("x-internal-secret");
    if (secret !== process.env.INTERNAL_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { to, link } = await req.json();

    await ctx.runAction(internal.emails.sendMagicLinkEmail, { to, link });

    return new Response("OK", { status: 200 });
  }),
});

export default http;
