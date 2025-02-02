import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

export const databaseUrl =
  process.env.NODE_ENV === "production"
    ? process.env.NEON_DB_URL
    : process.env.LOCAL_DB_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const client = postgres(databaseUrl);
export const db = drizzle(client);
