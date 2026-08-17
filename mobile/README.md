# Vici Expense & Bill Tracker — Mobile client (Expo / React Native)

The cross-platform mobile client for the Expense & Bill Tracker v0 (VIC-10). One
TypeScript codebase → both stores, sharing the domain contract with the Next.js
backend that landed on the studio template (`/api/finance/*`).

## Why Expo / React Native

Locked in VIC-10: reuse the template's TypeScript stack, share request/response
types with the backend (`src/api/types.ts` mirrors
`../src/lib/db/finance-schema.ts`), ship one codebase to iOS + Android.

## Run it

```bash
cd mobile
cp .env.example .env.local        # point EXPO_PUBLIC_API_BASE_URL at the backend
npm install                       # or pnpm/yarn
npm run start                     # Expo dev server; press i / a for iOS / Android
```

The backend is the Next.js app in the repo root (`pnpm dev`, port 3000). On a
physical device set `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP.

```bash
npm run typecheck                 # tsc --noEmit
```

## Architecture

```
src/
  api/        types.ts (shared domain contract) · client.ts (typed fetch + cookie replay)
  auth/       session.ts (SecureStore) · biometric.ts · AuthContext.tsx
  sync/       db.ts (AsyncStorage snapshot + outbox) · store.ts (zustand) · engine.ts (delta loop)
  lib/        money.ts (minor-units, multi-currency) · useShake.ts
  components/ theme.ts · ui.tsx · SyncBadge.tsx
app/          expo-router routes (auth, lock, tabs, modals, feature screens)
```

### Offline-first + delta sync (the "never lose your data" wedge)

Every mutation writes to local state **and** a durable outbox synchronously, so
the UI is instant and nothing is lost if the app is killed offline. The sync
engine (`src/sync/engine.ts`) runs every 15s and on foreground:

1. **Push** — drains the outbox in order. Local ids (`local-…`) are remapped to
   server ids as creates land, so a transaction added against a
   just-created-offline account still resolves. Poison ops (4xx) are dropped so
   the queue can't wedge; network/5xx errors pause with the queue intact.
2. **Pull** — `GET /api/finance/sync?since=<cursor>` and folds every changed row
   (including soft-delete tombstones) back in with **last-write-wins** by
   `updatedAt`. Locally-newer edits are never clobbered.

Auth uses the backend's `vici_session` JWT cookie. React Native's fetch has no
cookie jar, so the client captures the token from `Set-Cookie` on login/signup,
stores it in the OS keychain (`expo-secure-store`), and replays it as a `Cookie`
header. A biometric / passcode gate (`expo-local-authentication`) guards relaunch.

## Screen ↔ backend status

| Screen | Backend | Status |
| --- | --- | --- |
| Auth (login/signup) | `/api/auth/*` | ✅ wired |
| Biometric lock | device | ✅ |
| Accounts + unified balance + add | `/api/finance/accounts` | ✅ |
| Transactions: quick-add (shake/long-press/＋), edit, search, status chip, assignment, multi-currency | `/api/finance/transactions[/:id]` | ✅ |
| Reconcile (cleared → reconciled) | `PATCH …/transactions/:id` | ✅ |
| Receivables / IOU + settle | transactions `kind:"iou"` | ✅ |
| Reports (category / contributor / object-person) | derived from synced txns | ✅ |
| Offline-first + delta sync + tombstones | `/api/finance/sync` | ✅ |
| Budgets (per-category limits/progress) | `/api/finance/budgets` | ⏳ backend route not built yet — shows month spend + banner |
| Bills & reminders (push, lead time, partial) | `/api/finance/bills` + push infra (VIC-9) | ⏳ documented surface, blocked |
| Subscription paywall | entitlement (VIC-11) | ⏸ free launch window — gate dormant behind a flag |

## Honest ship gate

This is a runnable, offline-first client that syncs against the real backend.
**Store submission** (App Store / Play Store) still needs: the sibling backend
issue to add `/api/finance/{budgets,bills}`, VIC-9 prod infra for push +
managed API, and app-store accounts/signing — realistically the cross-platform
mobile hire flagged under VIC-1. See the VIC-10 thread.
