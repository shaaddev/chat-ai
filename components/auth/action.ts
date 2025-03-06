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
    console.log(error);
  }
};

export const confirm_otp = async (formData: FormData, email: string) => {
  const { otp } = Object.fromEntries(formData);

  await authClient.signIn.emailOtp({
    email: email,
    otp: otp as string,
  });

  return {
    success: true,
    redirectUrl: "/",
  };
};
