"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export const updateUser = async (formData: FormData) => {
  const new_fullName = formData.get("new_fullName") as string;
  const new_email = formData.get("new_email") as string;

  if (!new_fullName || !new_email) {
    return { error: "Missing required fields" };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

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
