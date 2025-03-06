"use server";

import React from "react";
import { Resend } from "resend";
import Email from "@/emails/otp-message";

const resend = new Resend(process.env.RESEND_API_KEY);

export const otp_message = async (email: string, otp: string) => {
  try {
    await resend.emails.send({
      from: "Chat - Shaaddev <chat@shaaddev.com>",
      to: [email],
      subject: "Chat Sign-in Verification",
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
