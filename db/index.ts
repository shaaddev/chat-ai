import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

export const databaseUrl =
  process.env.NODE_ENV === "production"
    ? process.env.NEON_DB
    : process.env.LOCAL_DB;

if (!databaseUrl) {
  throw new Error("URL is not set");
}

export const client = postgres(databaseUrl);
export const db = drizzle(client);
