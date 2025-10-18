"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/app/auth";

export const updateUser = async (formData: FormData) => {
  const new_fullName = formData.get("new_fullName") as string;
  const new_email = formData.get("new_email") as string;

  if (!new_fullName || !new_email) {
    return { error: "Missing required fields" };
  }

  const session = await auth();

  if (!session) {
    return { error: "Unauthorized" };
  }

  try {
    await db
      .update(user)
      .set({ name: new_fullName, email: new_email })
      .where(eq(user.id, session.user.id));

    return {
      success: true,
    };
  } catch (err) {
    return {
      success: false,
      error: err,
    };
  }
};
