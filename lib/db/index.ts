import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

function connect() {
  const url = process.env.NEON_DB;
  if (!url) {
    throw new Error("NEON_DB is not set");
  }
  // Neon's pooler runs PgBouncer in transaction mode, which cannot keep
  // named prepared statements across transactions.
  return drizzle(postgres(url, { prepare: false }));
}

export type Database = ReturnType<typeof connect>;

let instance: Database | undefined;

// Connect on first use so `next build` and secret-less preview builds never
// need NEON_DB.
export function getDb(): Database {
  instance ??= connect();
  return instance;
}
