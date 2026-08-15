# Observability — analytics, error monitoring & metrics

Everything the studio ships is measurable by default. This module gives every
product three things out of the box:

1. **Product analytics** — activation, retention (D1/D7/D30 cohorts) and funnel
   events, via a typed `track()` API (client + server).
2. **Error/exception monitoring** — client global handlers + React
   `ErrorBoundary`, server capture, and an ingestion endpoint.
3. **An internal metrics view** — `/metrics`, a self-contained dashboard.

It follows the template's core principle: **runs with zero infra.** With no
`DATABASE_URL` it uses an in-memory store; set `DATABASE_URL` and it persists to
Postgres via Drizzle — no code changes.

## Layout

```
src/lib/observability/
  types.ts        # event taxonomy + zod wire schemas
  aggregate.ts    # PURE funnel/retention/summary math (no runtime deps)
  metrics.ts      # loads a window from the store -> aggregate.summarize()
  store.ts        # ObservabilityStore: in-memory (default) | Postgres (Drizzle)
  analytics.ts    # server track() / captureError() + anon distinctId cookie
  index.ts        # public barrel
src/lib/db/observability-schema.ts   # Drizzle tables (obs_events, obs_errors)
src/app/api/track/route.ts           # POST analytics ingestion
src/app/api/errors/route.ts          # POST error ingestion
src/app/api/metrics/route.ts         # GET metrics JSON (token-guarded in prod)
src/app/metrics/page.tsx             # the internal metrics dashboard
src/components/observability/        # AnalyticsProvider, useAnalytics, ErrorBoundary, chart UI
scripts/verify-metrics.ts            # dependency-free unit checks for the math
```

## Wiring (3 steps)

**1. Mount the client SDK** in the root layout so page views + client errors are
captured automatically:

```tsx
// src/app/layout.tsx
import { AnalyticsProvider } from "@/components/observability";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
```

**2. Emit funnel/activation events** where they happen:

```tsx
"use client";
import { useAnalytics } from "@/components/observability";
const { track } = useAnalytics();
track("signup_started");
// ...on the aha moment:
track("activated", { plan: "pro" });
```

Server side (route handlers, server actions):

```ts
import { track } from "@/lib/observability";
await track("subscribed", { userId, props: { amountCents: 2000 } });
```

**3. Point Drizzle at the observability tables** (only needed for Postgres
persistence). In `drizzle.config.ts`, include the schema file:

```ts
schema: ["./src/lib/db/schema.ts", "./src/lib/db/observability-schema.ts"],
```

Then `pnpm db:push` (or generate + migrate) creates `obs_events` / `obs_errors`.
No DB? Skip this — the in-memory store is used automatically.

## The metrics view

Visit **`/metrics`**. It shows activation rate, the conversion funnel, retention
cohorts, an events/errors trend, and a recent-error feed. A machine-readable
version is at **`GET /api/metrics?windowDays=30`**.

### Securing it

`/metrics` and `/api/metrics` expose internal data. In production:

- Put `/metrics` behind admin/staff auth (e.g. gate it in `middleware.ts` or the
  route). The template's auth (VIC-4) provides the session to check.
- `GET /api/metrics` requires `Authorization: Bearer $METRICS_TOKEN` in prod
  (open in dev). Set `METRICS_TOKEN` in the environment.

## Configuration

| Env var            | Default      | Purpose                                            |
| ------------------ | ------------ | -------------------------------------------------- |
| `DATABASE_URL`     | *(unset)*    | Postgres persistence; unset ⇒ in-memory store.     |
| `ACTIVATION_EVENT` | `activated`  | Which event counts as activation for metrics.      |
| `METRICS_TOKEN`    | *(unset)*    | Bearer token guarding `/api/metrics` in prod.      |

## Testing

```
node scripts/verify-metrics.mts   # Node >= 23.6
# or: node --experimental-strip-types scripts/verify-metrics.mts   # Node 22.6–23.5
```

Covers the funnel, retention cohort, activation-rate, error-rate and timeseries
logic with a fixed clock — no database or Next.js build required.
```
