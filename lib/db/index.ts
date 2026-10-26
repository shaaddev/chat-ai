import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

function connect() {
  const url = process.env.NEON_DB;
  if (!url) {
    throw new Error("NEON_DB is not set");
  }
  // Close idle sockets before Vercel freezes the instance or Neon scales to
  // zero, so a warm function never reuses a dead connection.
  return drizzle(
    postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 10 })
  );
}

export type Database = ReturnType<typeof connect>;

let instance: Database | undefined;

export function getDb(): Database {
  instance ??= connect();
  return instance;
}
