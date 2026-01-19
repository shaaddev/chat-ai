"use server";

// Note: User profile updates and auth actions should be done through Better Auth client directly
// This file is kept for backwards compatibility

export const get_email = async (formData: FormData) => {
  const { email } = Object.fromEntries(formData);

  if (!email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  // The Better Auth client on the frontend handles sending the OTP
  return {
    success: true,
    email: email as string,
  };
};

export const verify_otp = async (formData: FormData) => {
  const { pin, email } = Object.fromEntries(formData);

  if (!pin || !email) {
    return {
      message: "Missing required fields",
      error: "Invalid message",
    };
  }

  // Better Auth client handles verification directly
  return {
    success: true,
  };
};

export const logout = async () => {
  // Logout is handled by Better Auth client directly
  return { success: true };
};
