import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Lazy DB client. Module-load throw was the spec, but Phase 1 needs
 * `pnpm dev` to boot before a Neon URL is provisioned, so we defer
 * the check to first use. The seed script and any route handler that
 * touches `db` will fail loudly with the same error if DATABASE_URL
 * is missing.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function build() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and configure a Neon connection string.",
    );
  }
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop, receiver) {
    if (!_db) _db = build();
    return Reflect.get(_db, prop, receiver);
  },
});

export { schema };
