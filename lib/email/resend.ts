"use server";

import React from "react";
import { Resend } from "resend";
import Email from "@/emails/otp-message";
import MagicLinkEmail from "@/emails/magic-link";

const resend = new Resend(process.env.RESEND_API_KEY);

export const otp_message = async (email: string, otp: string) => {
  try {
    await resend.emails.send({
      from: "Chat <chat@shaaddev.com>",
      to: [email],
      subject: `${otp} - Chat Sign-in Verification`,
      react: React.createElement(Email, {
        email: email as string,
        otp: otp as string,
      }),
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error,
    };
  }
};

export const magic_link_message = async (email: string, url: string) => {
  try {
    await resend.emails.send({
      from: "chat <chat@shaaddev.com>",
      to: [email],
      subject: `Magic Link Verification`,
      react: React.createElement(MagicLinkEmail, {
        email: email as string,
        link: url as string,
      }),
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error,
    };
  }
};
