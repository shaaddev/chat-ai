import { cookies } from "next/headers";
import { convex, api } from "@/lib/convex/server";

export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
  session: {
    id: string;
    expiresAt: number;
  };
} | null;

export const auth = async (): Promise<Session> => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const result = await convex.query(api.auth.getSession, {
      token: sessionToken,
    });

    if (!result) {
      return null;
    }

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image,
      },
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt,
      },
    };
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
};
