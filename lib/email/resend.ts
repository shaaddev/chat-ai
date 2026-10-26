import "server-only";

import React from "react";
import { Resend } from "resend";
import OtpEmail from "@/emails/otp-link";

export async function sendOtpEmail(email: string, pin: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    console.info(`[auth] OTP for ${email}: ${pin}`);
    return;
  }

  const { error } = await new Resend(apiKey).emails.send({
    from: "chat <chat@shaaddev.com>",
    to: [email],
    subject: "One-Time Password Verification",
    react: React.createElement(OtpEmail, { email, pin }),
  });
  if (error) {
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
}
