// Auth types for Convex-based authentication
// The actual auth implementation is in convex/auth.ts and components/auth/action.ts

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

// Re-export auth from app/auth.ts for convenience
export { auth } from "@/app/auth";
