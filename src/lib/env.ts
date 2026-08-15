/**
 * Centralized, lazily-read environment access.
 *
 * The starter is designed to boot with ZERO configuration: every value here has
 * a safe local-dev default so `pnpm dev` works before you provision any infra.
 * Wire real values via `.env` (see `.env.example`) as you go.
 */

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  // Dev-only fallback secret. Set AUTH_SECRET in production.
  authSecret:
    process.env.AUTH_SECRET ??
    "dev-only-insecure-secret-change-me-in-production-00000000",

  databaseUrl: process.env.DATABASE_URL ?? "",

  billing: {
    provider: (process.env.BILLING_PROVIDER ?? "stub") as "stub" | "stripe",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    stripePriceId: process.env.STRIPE_PRICE_ID ?? "",
  },
} as const;

export const isProd = process.env.NODE_ENV === "production";

/** True when a real Postgres connection string is configured. */
export const hasDatabase = env.databaseUrl.length > 0;

if (isProd && env.authSecret.startsWith("dev-only")) {
  // Surface a loud warning rather than silently shipping an insecure secret.
  console.warn(
    "[env] AUTH_SECRET is not set — using an insecure dev fallback in production."
  );
}
