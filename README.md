# Vici Labs — Studio Starter Template

The reusable, **niche-agnostic foundation** every Vici Labs product starts from.
Clone it, rename it, and you begin at ~60% instead of 0%: authentication, a
billing stub, an app shell, and a working CI/CD pipeline are already wired.

> **Design goal:** boots with **zero configuration**. `pnpm dev` works before you
> provision any database or payment account — the template falls back to an
> in-memory store and a billing stub, then upgrades cleanly as you add real infra.

---

## Stack

| Concern      | Choice                                              | Why |
|--------------|-----------------------------------------------------|-----|
| Language/UI  | **TypeScript + React** via **Next.js 15** (App Router) | One full-stack deployable, low-ops |
| Styling      | **Tailwind CSS v4**                                 | Fast, no config |
| Database     | **Postgres + Drizzle ORM**                          | Typed schema + migrations; in-memory fallback for local dev |
| Auth         | Email + password, **bcrypt** hashes, signed **JWT** sessions (`jose`) | No vendor lock-in; Edge-safe middleware |
| Billing      | **Provider interface** + zero-config **stub** (+ Stripe impl) | Clickable billing before you have a Stripe account |
| CI/CD        | **GitHub Actions**                                  | Lint/typecheck/build + live hello env + Vercel deploy |
| Hosting      | **Vercel** (app) · **GitHub Pages** (hello env)     | Low-ops; hello env needs no secrets |

---

## Quickstart

```bash
pnpm install
cp .env.example .env      # optional — sensible defaults work out of the box
pnpm dev                  # http://localhost:3000
```

Then:

- Visit `/` (marketing), `/signup`, `/login`.
- Sign up → you land on `/dashboard` (session cookie set).
- Click **Upgrade** — the stub billing flow marks you active instantly.
- Hit `GET /api/hello` for a JSON liveness payload.

No `DATABASE_URL`? Users live in an in-memory store for the session — perfect for
a first run. Set `DATABASE_URL` to switch to Postgres automatically.

---

## Project layout

```
src/
  app/
    page.tsx                 Marketing landing
    (auth)/login|signup      Auth pages
    dashboard/               Authenticated app shell (guarded by middleware)
    api/
      hello/                 Liveness endpoint
      auth/                  login · signup · logout
      billing/              checkout · portal
  components/                UI (auth form, nav, billing panel)
  lib/
    env.ts                   Central env access with safe defaults
    auth/                    session (Edge-safe JWT) · password (bcrypt) · helpers
    billing/                 provider interface · stub · stripe · resolver
    db/                      Drizzle client · schema · users repository
  middleware.ts              Protects /dashboard
hello/index.html             Static "hello" env deployed to GitHub Pages
.github/workflows/           ci · deploy-pages · deploy-vercel
```

---

## Auth

- `src/lib/auth/session.ts` — signs/verifies session JWTs (safe to import from
  Edge middleware).
- `src/lib/auth/password.ts` — bcrypt hashing (Node runtime only).
- `src/lib/auth/index.ts` — `getCurrentUser()`, `startSession()`, `endSession()`
  for Route Handlers / Server Components.
- **Upgrade path:** to add OAuth, drop in Auth.js or your provider and keep the
  same `getCurrentUser()` contract so the rest of the app is unchanged.

## Billing

Product code depends only on the `BillingProvider` interface
(`src/lib/billing/provider.ts`). The default `stub` needs no account. To go live:

```bash
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Then implement the webhook to update `users.billingStatus` (marked as a TODO in
`src/lib/billing/stripe.ts`).

## Database

```bash
# with DATABASE_URL set:
pnpm db:generate   # create SQL migrations from schema
pnpm db:migrate    # apply them
pnpm db:push       # or push directly while prototyping
```

Add product tables to `src/lib/db/schema.ts`; keep the `users` id/email contract
stable so shared auth/billing code keeps working.

---

## Deploy

### Hello environment (live now, no secrets)

`deploy-pages.yml` publishes `hello/index.html` to **GitHub Pages** on every push
to `main` using the built-in `GITHUB_TOKEN`. Enable Pages once
(Settings → Pages → Source: **GitHub Actions**) and the URL goes live.

### Full app → Vercel

`deploy-vercel.yml` deploys the Next.js app. Add these repo secrets and set the
repo variable `ENABLE_VERCEL_DEPLOY=true`:

| Secret / Var         | Where from |
|----------------------|-----------|
| `VERCEL_TOKEN`       | Vercel account → tokens |
| `VERCEL_ORG_ID`      | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID`  | `.vercel/project.json` after `vercel link` |
| `ENABLE_VERCEL_DEPLOY` (variable) | `true` |

Also set runtime env in Vercel: `AUTH_SECRET`, `DATABASE_URL`, and any `STRIPE_*`.
Provision Postgres with **Neon** or **Supabase** (both have low-ops free tiers).

---

## Starting a new product from this template

1. `gh repo create <product> --template vici-labs/vici-labs-starter` (or clone).
2. Rename in `package.json` and `src/app/layout.tsx` metadata.
3. Add your product tables + core surface under `src/app/dashboard`.
4. Set `AUTH_SECRET` + `DATABASE_URL`, provision Postgres, `pnpm db:migrate`.
5. Flip billing to Stripe when you're ready to charge.
6. Add Vercel secrets → push → you're live.

You're starting at ~60%. Ship the part that's actually new.

---

## Scripts

| Command             | Does |
|---------------------|------|
| `pnpm dev`          | Local dev server |
| `pnpm build`        | Production build |
| `pnpm start`        | Serve the production build |
| `pnpm lint`         | ESLint (next config) |
| `pnpm typecheck`    | `tsc --noEmit` |
| `pnpm db:*`         | Drizzle migrate / generate / push |
