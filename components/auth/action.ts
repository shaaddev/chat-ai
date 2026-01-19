"use server";

import { cookies } from "next/headers";
import { convex, api } from "@/lib/convex/server";
import { email_otp_message } from "@/lib/email/resend";

export const get_email = async (formData: FormData) => {
  const { email } = Object.fromEntries(formData);

  if (!email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  try {
    // Request OTP from Convex (this generates and stores the OTP)
    const result = await convex.action(api.auth.requestOtp, {
      email: email as string,
    });

    // Send the OTP via email using Resend
    await email_otp_message(email as string, result.otp);

    return {
      success: true,
      email: email as string,
    };
  } catch (error) {
    console.error("Error sending OTP:", error);
    return {
      success: false,
      redirectUrl: "/",
      error: error,
    };
  }
};

export const verify_otp = async (formData: FormData) => {
  const { pin, email } = Object.fromEntries(formData);

  if (!pin || !email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  try {
    // Verify OTP with Convex
    const result = await convex.mutation(api.auth.verifyOtp, {
      email: email as string,
      code: pin as string,
    });

    if (!result.success) {
      return {
        success: false,
        message: result.error || "Invalid OTP",
      };
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session", result.sessionToken!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return {
      success: false,
      error: error,
    };
  }
};

export const logout = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (sessionToken) {
    try {
      await convex.mutation(api.auth.deleteSession, { token: sessionToken });
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  }

  cookieStore.delete("session");

  return { success: true };
};
