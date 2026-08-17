import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getStore } from "./store";
import type { AnalyticsEvent, ErrorEvent, EventName } from "./types";

/**
 * Server-side analytics API. Client code posts to `/api/track` and `/api/errors`
 * (see the route handlers), which ultimately call these helpers. Server code
 * (route handlers, server actions) can call `track()` directly.
 */

export const ANON_COOKIE = "obs_did";
const ANON_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

/**
 * Reads the stable anonymous visitor id from the cookie, minting one if absent.
 * Safe to call from route handlers / server actions (needs a writable cookie
 * store). In read-only contexts pass an explicit `distinctId` to `track()`.
 */
export async function getOrCreateDistinctId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing) return existing;
  const id = `anon_${randomUUID()}`;
  try {
    jar.set(ANON_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ANON_MAX_AGE,
      path: "/",
    });
  } catch {
    // cookies().set throws in read-only render contexts; the id is still usable
    // for this request even if not persisted.
  }
  return id;
}

export interface TrackOptions {
  distinctId?: string;
  userId?: string | null;
  props?: Record<string, unknown>;
  ts?: number;
}

/** Records a single analytics event. Never throws — analytics must not break UX. */
export async function track(
  name: EventName,
  opts: TrackOptions = {}
): Promise<void> {
  try {
    const distinctId = opts.distinctId ?? (await getOrCreateDistinctId());
    const event: AnalyticsEvent = {
      id: randomUUID(),
      name,
      distinctId,
      userId: opts.userId ?? null,
      props: opts.props ?? {},
      // Server time is authoritative; a client-supplied ts is only a hint and is
      // ignored here to keep funnel/retention windows trustworthy.
      ts: opts.ts ?? Date.now(),
    };
    await getStore().recordEvent(event);
  } catch (err) {
    console.error("[observability] failed to record event", name, err);
  }
}

export interface CaptureErrorInput {
  message: string;
  stack?: string | null;
  source?: string;
  distinctId?: string | null;
  userId?: string | null;
  path?: string | null;
  context?: Record<string, unknown>;
  ts?: number;
}

/** Records a captured error/exception. Never throws. */
export async function captureError(input: CaptureErrorInput): Promise<void> {
  try {
    const event: ErrorEvent = {
      id: randomUUID(),
      message: input.message.slice(0, 2000),
      stack: input.stack ?? null,
      source: input.source ?? "server",
      distinctId: input.distinctId ?? null,
      userId: input.userId ?? null,
      path: input.path ?? null,
      context: input.context ?? {},
      ts: input.ts ?? Date.now(),
    };
    await getStore().recordError(event);
  } catch (err) {
    // Last-resort: don't let the monitor become the outage.
    console.error("[observability] failed to record error", err);
  }
}
