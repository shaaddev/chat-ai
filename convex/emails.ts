"use node";

import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import React from "react";
import * as ReactDOMServer from "react-dom/server";
import MagicLinkEmail from "../emails/magic-link";
import OtpEmail from "../emails/otp-link";
import { components } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

// Initialize Resend component
export const resend = new Resend(components.resend, {
  testMode: false,
});

// Helper to render React components to HTML string
function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

// Internal action: Send OTP verification email (called from HTTP endpoint)
export const sendOtpEmail = internalAction({
  args: {
    to: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const html = renderToHtml(
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
    const html = renderToHtml(
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
      html = renderToHtml(
        React.createElement(OtpEmail, {
          email: args.data.email,
          pin: args.data.pin,
        })
      );
    } else if (
      args.template === "magic-link" &&
      args.data.link &&
      args.data.email
    ) {
      html = renderToHtml(
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
