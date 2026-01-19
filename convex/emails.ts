"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { render } from "@react-email/render";
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import OtpEmail from "../emails/otp-link";
import MagicLinkEmail from "../emails/magic-link";
import React from "react";

// Initialize Resend component
export const resend = new Resend(components.resend, {
  testMode: false,
});

// Internal action: Send OTP verification email (called from HTTP endpoint)
export const sendOtpEmail = internalAction({
  args: {
    to: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const html = await render(
      React.createElement(OtpEmail, {
        email: args.to,
        pin: args.otp,
      })
    );

    await resend.sendEmail(ctx, {
      from: "chat <chat@shaaddev.com>",
      to: args.to,
      subject: "One-Time Password Verification",
      html,
    });
  },
});

// Internal action: Send magic link email (called from HTTP endpoint)
export const sendMagicLinkEmail = internalAction({
  args: {
    to: v.string(),
    link: v.string(),
  },
  handler: async (ctx, args) => {
    const html = await render(
      React.createElement(MagicLinkEmail, {
        email: args.to,
        link: args.link,
      })
    );

    await resend.sendEmail(ctx, {
      from: "chat <chat@shaaddev.com>",
      to: args.to,
      subject: "Magic Link Verification",
      html,
    });
  },
});

// Public action: Send a custom email using React Email templates
export const sendCustomEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    template: v.union(v.literal("otp"), v.literal("magic-link")),
    data: v.object({
      email: v.optional(v.string()),
      pin: v.optional(v.string()),
      link: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    let html: string;

    if (args.template === "otp" && args.data.pin) {
      html = await render(
        React.createElement(OtpEmail, {
          email: args.data.email,
          pin: args.data.pin,
        })
      );
    } else if (args.template === "magic-link" && args.data.link && args.data.email) {
      html = await render(
        React.createElement(MagicLinkEmail, {
          email: args.data.email,
          link: args.data.link,
        })
      );
    } else {
      throw new Error("Invalid template or missing data");
    }

    await resend.sendEmail(ctx, {
      from: "chat <chat@shaaddev.com>",
      to: args.to,
      subject: args.subject,
      html,
    });
  },
});
