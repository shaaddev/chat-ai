"use server";
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";
// import { isEmail } from "@/db/queries";

export const get_email = async (formData: FormData) => {
  const { email } = Object.fromEntries(formData);

  if (!email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  // const checkEmail = await isEmail(email as string);

  // if (!checkEmail) {
  //   return {
  //     success: false,
  //   };
  // }

  try {
    await authClient.signIn.magicLink({
      email: email as string,
      callbackURL: "/",
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

export const confirm_otp = async (formData: FormData, email: string) => {
  const { otp } = Object.fromEntries(formData);

  if (!otp) {
    return {
      success: false,
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  try {
    const { data } = await authClient.signIn.emailOtp({
      email: email,
      otp: otp as string,
    });

    return {
      data: data,
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

export const sign_out = async () => {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        redirect("/");
      },
    },
  });
};
