import { isAuthenticated, fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";

export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
} | null;

export const auth = async (): Promise<Session> => {
  try {
    // First check if the user is authenticated
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
      return null;
    }

    const user = await fetchAuthQuery(api.auth.getCurrentUser);

    if (!user) {
      return null;
    }

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    };
  } catch (error) {
    // Gracefully handle unauthenticated or other errors
    // Don't log errors for expected unauthenticated state
    if (error instanceof Error && error.message?.includes("Unauthenticated")) {
      return null;
    }
    // Only log unexpected errors
    console.error("Auth error:", error);
    return null;
  }
};
