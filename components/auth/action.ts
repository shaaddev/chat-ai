"use server";
import { authClient } from "@/lib/auth/auth-client";
import { generateOTP } from "@/lib/utils";

export const get_email = async (formData: FormData) => {
  const { email } = Object.fromEntries(formData);

  if (!email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  console.log(`Before: ${email}`);

  try {
    const { data, error } = authClient.emailOtp.sendVerificationOtp({
      email: email as string,
      type: "sign-in",
    });

    const encodedEmail = encodeURIComponent(email as string);

    console.log(`During try-catch: ${email}`);
    return {
      success: true,
      redirectUrl: `/login?email=${encodedEmail}`,
      email: email as string,
    };
  } catch (error) {
    console.log(error);
  }
};

export const send_otp = async () => {
  const { data, error } = authClient.signIn.emailOtp({
    email: "",
    otp: generateOTP(),
  });
};
