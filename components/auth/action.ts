"use server";
import { authClient } from "@/lib/auth/auth-client";

export const get_email = async (formData: FormData) => {
  const { email } = Object.fromEntries(formData);

  if (!email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  try {
    await authClient.emailOtp.sendVerificationOtp({
      email: email as string,
      type: "sign-in",
    });

    const encodedEmail = encodeURIComponent(email as string);

    return {
      success: true,
      redirectUrl: `/login?email=${encodedEmail}`,
      email: email as string,
    };
  } catch (error) {
    return {
      success: false,
      redirectUrl: "/",
      error: error,
    };
  }
};

export const confirm_otp = async (formData: FormData, email: string) => {
  const { otp } = Object.fromEntries(formData);

  if (!otp) {
    return {
      success: false,
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  console.log(`\nBefore: ${otp}\n`);

  try {
    await authClient.signIn.emailOtp({
      email: email,
      otp: otp as string,
    });
    console.log(`\nDuring try-catch: ${otp}\n`);

    return {
      success: true,
      redirectUrl: "/",
    };
  } catch (error) {
    return {
      success: false,
      redirectUrl: "/",
      error: error,
    };
  }
};
