import { config as loadEnv } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit doesn't auto-load .env.local, so we pull it in ourselves.
// .env.local first (developer overrides), then .env as a fallback.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
} satisfies Config;
