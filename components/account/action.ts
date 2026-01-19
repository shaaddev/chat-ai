"use server";

import { convex, api } from "@/lib/convex/server";
import { auth } from "@/app/auth";
import type { Id } from "@/convex/_generated/dataModel";

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
    await convex.mutation(api.users.update, {
      id: session.user.id as Id<"users">,
      name: new_fullName,
      email: new_email,
    });

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
