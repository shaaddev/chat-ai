import { fileURLToPath } from "node:url";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { user } from "./schema";

const url = process.env.TEST_DATABASE_URL;

// The app's queries connect through NEON_DB. Point it at the test database, or
// at nothing, so a test can never reach a real one.
process.env.NEON_DB = url ?? "";

export const hasTestDatabase = url !== undefined;

export async function openTestDatabase() {
  const client = postgres(url ?? "", { max: 1, onnotice: () => undefined });
  const db = drizzle(client);
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("migrations", import.meta.url)),
  });
  const userIds: string[] = [];

  return {
    db,
    async createUser() {
      const id = crypto.randomUUID();
      await db
        .insert(user)
        .values({ id, name: "Test user", email: `${id}@example.test` });
      userIds.push(id);
      return id;
    },
    async close() {
      if (userIds.length > 0) {
        await db.delete(user).where(inArray(user.id, userIds));
      }
      await client.end();
    },
  };
}
