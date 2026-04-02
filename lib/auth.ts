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
