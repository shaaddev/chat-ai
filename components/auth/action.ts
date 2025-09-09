"use server";
import { authClient } from "@/lib/auth-client";
import { isEmail } from "@/db/queries";
import { auth } from "@/lib/auth";

export const get_email = async (formData: FormData) => {
  const { email } = Object.fromEntries(formData);

  if (!email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  // note: comment this out to add users
  const checkEmail = await isEmail(email as string);

  if (!checkEmail) {
    return {
      success: false,
    };
  }

  try {
    // await authClient.signIn.magicLink({
    //   email: email as string,
    //   callbackURL: "/",
    // });

    const { data, error } = await authClient.emailOtp.sendVerificationOtp({
      email: email as string,
      type: "sign-in",
    });

    return {
      success: true,
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

export const verify_otp = async (formData: FormData) => {
  const { pin, email } = Object.fromEntries(formData);

  if (!pin || !email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  try {
    await auth.api.signInEmailOTP({
      body: {
        email: email as string,
        otp: pin as string,
      },
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
