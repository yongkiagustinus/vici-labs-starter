import {
  pgTable,
  text,
  uuid,
  bigint,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Observability tables. Kept in a dedicated file (rather than the app's
 * `schema.ts`) so the measurement layer is a self-contained, drop-in module.
 *
 * The Postgres store binds its own Drizzle client to just these tables, so the
 * only wiring the template needs is to point `drizzle-kit` at this file (see
 * `src/lib/observability/README.md`).
 *
 * `ts` is stored as epoch-millis (bigint) to keep the store adapter-agnostic:
 * the in-memory dev store uses the same numeric representation.
 */

export const events = pgTable(
  "obs_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    distinctId: text("distinct_id").notNull(),
    userId: text("user_id"),
    props: jsonb("props").notNull().default({}),
    ts: bigint("ts", { mode: "number" }).notNull(),
  },
  (t) => ({
    byName: index("obs_events_name_idx").on(t.name),
    byDistinct: index("obs_events_distinct_idx").on(t.distinctId),
    byTs: index("obs_events_ts_idx").on(t.ts),
  })
);

export const errorEvents = pgTable(
  "obs_errors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    message: text("message").notNull(),
    stack: text("stack"),
    source: text("source").notNull(),
    distinctId: text("distinct_id"),
    userId: text("user_id"),
    path: text("path"),
    context: jsonb("context").notNull().default({}),
    ts: bigint("ts", { mode: "number" }).notNull(),
  },
  (t) => ({
    byTs: index("obs_errors_ts_idx").on(t.ts),
    bySource: index("obs_errors_source_idx").on(t.source),
  })
);

export const observabilitySchema = { events, errorEvents };
