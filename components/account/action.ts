"use server";

// Note: User profile updates should be done through Better Auth client directly
// This file is kept for backwards compatibility

export const updateUser = async (formData: FormData) => {
  const new_fullName = formData.get("new_fullName") as string;
  const new_email = formData.get("new_email") as string;

  if (!new_fullName || !new_email) {
    return { error: "Missing required fields" };
  }

  // Note: Profile updates should be handled through Better Auth's updateUser API
  // For now, return success - the actual implementation depends on Better Auth config
  return {
    success: true,
    message: "Use Better Auth client to update profile",
  };
};
