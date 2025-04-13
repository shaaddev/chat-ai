"use server";
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";
import { isEmail } from "@/db/queries";

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

export const sign_out = async () => {
  // await auth.api.signOut()
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        redirect("/logout-success");
      },
    },
  });
};
