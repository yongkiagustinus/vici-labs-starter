import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env, hasDatabase } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle client. Only instantiated when DATABASE_URL is present.
 *
 * When no database is configured the app uses the in-memory user store
 * (see `./users-repo`) so the template runs with zero infra.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!hasDatabase) {
    throw new Error(
      "DATABASE_URL is not set — the Drizzle client is unavailable. " +
        "The template falls back to an in-memory store automatically."
    );
  }
  if (!_db) {
    const client = postgres(env.databaseUrl, { prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export { schema };
