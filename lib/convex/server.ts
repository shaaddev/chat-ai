import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

// Create a single HTTP client instance for server-side use
export const convex = new ConvexHttpClient(convexUrl);

// Re-export api for convenience
export { api };

// Type helper for Convex IDs
export type ConvexId<T extends string> = string & { __tableName: T };
