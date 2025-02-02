import type { Config } from "drizzle-kit";
import { config } from "dotenv";

config({
  path: ".env.local",
});

export default {
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.NODE_ENV === "production"
        ? `${process.env.NEON_DB_URL}`
        : `${process.env.LOCAL_DB_URL}`,
  },
  out: "./db/migrations",
} satisfies Config;
