import type { Config } from "drizzle-kit";
import { config } from "dotenv";
import { databaseUrl } from "./db";

config({
  path: ".env.local",
});

export default {
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl!,
  },
  out: "./db/migrations",
} satisfies Config;
