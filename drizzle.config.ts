import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit config for migrations. Requires DATABASE_URL to be set.
 * Generate:  pnpm db:generate
 * Apply:     pnpm db:migrate   (or db:push for prototyping)
 */
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
