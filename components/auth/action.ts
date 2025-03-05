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

  console.log(`Before: ${email}`);

  try {
    const { data, error } = authClient.emailOtp.sendVerificationOtp({
      email: email as string,
      type: "sign-in",
    });

    console.log(`During try-catch: ${email}`);
  } catch (error) {
    console.log(error);
  }
};

export const send_otp = async () => {
  const { data, error } = authClient.signIn.emailOtp({
    email: "",
    otp: generate(),
  });
};

function generate(): string {
  const min = 100000;
  const max = 999999;

  return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
}
