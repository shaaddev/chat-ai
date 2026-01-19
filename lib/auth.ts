// Auth types for Better Auth + Convex authentication
// The actual auth implementation is in convex/auth.ts

export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
} | null;

// Re-export auth from app/auth.ts for convenience
export { auth } from "@/app/auth";
