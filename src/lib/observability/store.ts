import { and, desc, gte, lte } from "drizzle-orm";
import type { AnalyticsEvent, ErrorEvent } from "./types";
import { env, hasDatabase } from "@/lib/env";

/**
 * Storage abstraction for the observability layer.
 *
 * Mirrors the template's core design principle (see `src/lib/db`): run with
 * ZERO infra by default. When `DATABASE_URL` is set we persist to Postgres via
 * Drizzle; otherwise events live in an in-memory ring buffer so `pnpm dev`,
 * tests, and previews work with no database at all.
 *
 * Aggregation lives in `metrics.ts` and operates on plain arrays, so both
 * adapters share one battle-tested code path.
 */

export interface EventQuery {
  /** Inclusive lower bound, epoch-millis. */
  since?: number;
  /** Inclusive upper bound, epoch-millis. */
  until?: number;
  /** Max rows (most recent first). Defaults to a safe cap. */
  limit?: number;
}

export interface ObservabilityStore {
  recordEvent(e: AnalyticsEvent): Promise<AnalyticsEvent>;
  recordError(e: ErrorEvent): Promise<ErrorEvent>;
  getEvents(q?: EventQuery): Promise<AnalyticsEvent[]>;
  getErrors(q?: EventQuery): Promise<ErrorEvent[]>;
}

const DEFAULT_LIMIT = 50_000;

// ---------------------------------------------------------------------------
// In-memory adapter (default, zero-infra).
// ---------------------------------------------------------------------------

/**
 * Kept on `globalThis` so Next.js dev hot-reloads don't wipe collected events
 * between requests. Bounded to avoid unbounded memory growth in long dev runs.
 */
const MEM_CAP = 100_000;

interface MemState {
  events: AnalyticsEvent[];
  errors: ErrorEvent[];
}

const globalForMem = globalThis as unknown as { __obsMem?: MemState };
const mem: MemState = (globalForMem.__obsMem ??= { events: [], errors: [] });

function inRange<T extends { ts: number }>(rows: T[], q: EventQuery = {}): T[] {
  const { since, until, limit = DEFAULT_LIMIT } = q;
  const filtered = rows.filter(
    (r) =>
      (since === undefined || r.ts >= since) &&
      (until === undefined || r.ts <= until)
  );
  // Most recent first, then cap.
  filtered.sort((a, b) => b.ts - a.ts);
  return filtered.slice(0, limit);
}

class MemoryStore implements ObservabilityStore {
  async recordEvent(e: AnalyticsEvent) {
    mem.events.push(e);
    if (mem.events.length > MEM_CAP) mem.events.splice(0, mem.events.length - MEM_CAP);
    return e;
  }
  async recordError(e: ErrorEvent) {
    mem.errors.push(e);
    if (mem.errors.length > MEM_CAP) mem.errors.splice(0, mem.errors.length - MEM_CAP);
    return e;
  }
  async getEvents(q?: EventQuery) {
    return inRange(mem.events, q);
  }
  async getErrors(q?: EventQuery) {
    return inRange(mem.errors, q);
  }
}

// ---------------------------------------------------------------------------
// Postgres adapter (Drizzle) — used when DATABASE_URL is configured.
// ---------------------------------------------------------------------------

class PostgresStore implements ObservabilityStore {
  // Lazily import drizzle so the in-memory path never pulls in `postgres`.
  private async client() {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { default: postgres } = await import("postgres");
    const schema = await import("@/lib/db/observability-schema");
    const g = globalThis as unknown as { __obsDb?: ReturnType<typeof drizzle> };
    if (!g.__obsDb) {
      const sql = postgres(env.databaseUrl, { prepare: false });
      g.__obsDb = drizzle(sql, { schema: schema.observabilitySchema });
    }
    return { db: g.__obsDb, schema };
  }

  async recordEvent(e: AnalyticsEvent) {
    const { db, schema } = await this.client();
    await db.insert(schema.events).values({
      id: e.id,
      name: e.name,
      distinctId: e.distinctId,
      userId: e.userId ?? null,
      props: e.props,
      ts: e.ts,
    });
    return e;
  }

  async recordError(e: ErrorEvent) {
    const { db, schema } = await this.client();
    await db.insert(schema.errorEvents).values({
      id: e.id,
      message: e.message,
      stack: e.stack ?? null,
      source: e.source,
      distinctId: e.distinctId ?? null,
      userId: e.userId ?? null,
      path: e.path ?? null,
      context: e.context,
      ts: e.ts,
    });
    return e;
  }

  async getEvents(q: EventQuery = {}) {
    const { db, schema } = await this.client();
    const { since, until, limit = DEFAULT_LIMIT } = q;
    const conds = [];
    if (since !== undefined) conds.push(gte(schema.events.ts, since));
    if (until !== undefined) conds.push(lte(schema.events.ts, until));
    const rows = await db
      .select()
      .from(schema.events)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.events.ts))
      .limit(limit);
    return rows.map(
      (r): AnalyticsEvent => ({
        id: r.id,
        name: r.name,
        distinctId: r.distinctId,
        userId: r.userId,
        props: (r.props ?? {}) as Record<string, unknown>,
        ts: Number(r.ts),
      })
    );
  }

  async getErrors(q: EventQuery = {}) {
    const { db, schema } = await this.client();
    const { since, until, limit = DEFAULT_LIMIT } = q;
    const conds = [];
    if (since !== undefined) conds.push(gte(schema.errorEvents.ts, since));
    if (until !== undefined) conds.push(lte(schema.errorEvents.ts, until));
    const rows = await db
      .select()
      .from(schema.errorEvents)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(schema.errorEvents.ts))
      .limit(limit);
    return rows.map(
      (r): ErrorEvent => ({
        id: r.id,
        message: r.message,
        stack: r.stack,
        source: r.source,
        distinctId: r.distinctId,
        userId: r.userId,
        path: r.path,
        context: (r.context ?? {}) as Record<string, unknown>,
        ts: Number(r.ts),
      })
    );
  }
}

let _store: ObservabilityStore | null = null;

/** Returns the process-wide store, choosing the adapter from env once. */
export function getStore(): ObservabilityStore {
  if (!_store) _store = hasDatabase ? new PostgresStore() : new MemoryStore();
  return _store;
}
