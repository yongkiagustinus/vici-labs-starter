import { z } from "zod";

/**
 * Observability event taxonomy.
 *
 * Keep this list small and product-agnostic. Each product extends it with its
 * own domain events, but the *shape* (name + props + distinctId + ts) stays
 * stable so shared analytics/metrics code keeps working across products.
 */

/** Canonical lifecycle / funnel events every product should emit. */
export const CORE_EVENTS = [
  "page_view",
  "signup_started",
  "signup_completed",
  "activated", // user reached the product's "aha" moment
  "feature_used",
  "checkout_started",
  "subscribed",
] as const;

export type CoreEventName = (typeof CORE_EVENTS)[number];
/** Products may emit their own event names too. */
export type EventName = CoreEventName | (string & {});

/**
 * The event a product considers "activation" (the aha moment). Retention and
 * activation-rate metrics key off this. Override via ACTIVATION_EVENT env if a
 * product uses a different signal.
 */
export const DEFAULT_ACTIVATION_EVENT: CoreEventName = "activated";

/**
 * Ordered funnel used by the metrics view's conversion chart. Steps must be
 * event names; each step's count is "distinct users who fired this event".
 */
export const DEFAULT_FUNNEL: readonly CoreEventName[] = [
  "signup_started",
  "signup_completed",
  "activated",
  "subscribed",
] as const;

/** A single analytics event as stored. */
export interface AnalyticsEvent {
  id: string;
  name: EventName;
  /** Stable per-user (or per-anonymous-visitor) id used for funnels/retention. */
  distinctId: string;
  /** Set once we know the authenticated user id. */
  userId?: string | null;
  /** Arbitrary, JSON-serializable event properties. */
  props: Record<string, unknown>;
  /** Server-assigned receive time (ms since epoch). */
  ts: number;
}

/** A captured error / exception as stored. */
export interface ErrorEvent {
  id: string;
  message: string;
  stack?: string | null;
  /** "client" | "server" | route/component that reported it. */
  source: string;
  /** Best-effort user/visitor association. */
  distinctId?: string | null;
  userId?: string | null;
  /** Request path or component where it happened. */
  path?: string | null;
  /** Extra structured context (browser, release, etc.). */
  context: Record<string, unknown>;
  ts: number;
}

// ---------------------------------------------------------------------------
// Wire validation (zod) — used by the ingestion API routes.
// ---------------------------------------------------------------------------

export const trackEventSchema = z.object({
  name: z.string().min(1).max(120),
  /** Optional client-provided distinctId; server falls back to the anon cookie. */
  distinctId: z.string().min(1).max(200).optional(),
  userId: z.string().min(1).max(200).nullish(),
  props: z.record(z.unknown()).optional(),
  /** Optional client timestamp; server clamps/overrides for trust. */
  ts: z.number().int().positive().optional(),
});
export type TrackEventInput = z.infer<typeof trackEventSchema>;

export const errorReportSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(20000).nullish(),
  source: z.string().min(1).max(200).default("client"),
  path: z.string().max(2000).nullish(),
  context: z.record(z.unknown()).optional(),
  ts: z.number().int().positive().optional(),
});
export type ErrorReportInput = z.infer<typeof errorReportSchema>;
