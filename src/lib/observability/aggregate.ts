import type { AnalyticsEvent, ErrorEvent, EventName } from "./types";

/**
 * Pure metrics aggregation — NO runtime imports (only type-only imports, which
 * are erased). This keeps the core funnel/retention/summary math trivially
 * unit-testable with zero dependencies (see `scripts/verify-metrics.ts`) and
 * lets both storage adapters share one code path.
 *
 * All time windows are computed against a caller-supplied `now` so the
 * functions are deterministic in tests.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_ACTIVATION_EVENT = "activated";
export const DEFAULT_FUNNEL: readonly string[] = [
  "signup_started",
  "signup_completed",
  "activated",
  "subscribed",
];

export interface FunnelStep {
  name: string;
  users: number;
  stepConversion: number;
  overallConversion: number;
}

export interface RetentionCohort {
  day: string;
  size: number;
  d1: number;
  d7: number;
  d30: number;
}

export interface MetricsTotals {
  events: number;
  uniqueUsers: number;
  newUsers: number;
  activatedUsers: number;
  activationRate: number;
  errors: number;
  errorRate: number;
}

export interface MetricsSummary {
  windowDays: number;
  generatedAt: number;
  totals: MetricsTotals;
  funnel: FunnelStep[];
  retention: RetentionCohort[];
  topEvents: { name: string; count: number }[];
  recentErrors: ErrorEvent[];
  timeseries: { day: string; events: number; errors: number }[];
}

export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function activationFirstSeen(
  events: AnalyticsEvent[],
  activationEvent: EventName
): Map<string, number> {
  const first = new Map<string, number>();
  for (const e of events) {
    if (e.name !== activationEvent) continue;
    const prev = first.get(e.distinctId);
    if (prev === undefined || e.ts < prev) first.set(e.distinctId, e.ts);
  }
  return first;
}

export function computeFunnel(
  events: AnalyticsEvent[],
  steps: readonly EventName[] = DEFAULT_FUNNEL
): FunnelStep[] {
  const usersByStep = steps.map((name) => {
    const set = new Set<string>();
    for (const e of events) if (e.name === name) set.add(e.distinctId);
    return set.size;
  });
  const top = usersByStep[0] || 0;
  return steps.map((name, i) => {
    const users = usersByStep[i];
    const prev = i === 0 ? users : usersByStep[i - 1];
    return {
      name,
      users,
      stepConversion: prev > 0 ? users / prev : 0,
      overallConversion: top > 0 ? users / top : 0,
    };
  });
}

export function computeRetention(
  events: AnalyticsEvent[],
  now: number,
  activationEvent: EventName = DEFAULT_ACTIVATION_EVENT,
  cohortDays = 14
): RetentionCohort[] {
  const firstSeen = activationFirstSeen(events, activationEvent);

  const activeDays = new Map<string, Set<string>>();
  for (const e of events) {
    let s = activeDays.get(e.distinctId);
    if (!s) activeDays.set(e.distinctId, (s = new Set()));
    s.add(dayKey(e.ts));
  }

  const cohorts = new Map<string, string[]>();
  for (const [distinctId, ts] of firstSeen) {
    const key = dayKey(ts);
    const arr = cohorts.get(key) ?? cohorts.set(key, []).get(key)!;
    arr.push(distinctId);
  }

  const out: RetentionCohort[] = [];
  for (let i = cohortDays - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY_MS);
    const members = cohorts.get(key) ?? [];
    const size = members.length;
    const dayStartMs = new Date(key + "T00:00:00.000Z").getTime();

    const returned = (offset: number) => {
      if (size === 0) return 0;
      const target = dayKey(dayStartMs + offset * DAY_MS);
      let n = 0;
      for (const id of members) {
        if (activeDays.get(id)?.has(target)) n++;
      }
      return n / size;
    };

    out.push({ day: key, size, d1: returned(1), d7: returned(7), d30: returned(30) });
  }
  return out;
}

export interface SummarizeOptions {
  windowDays?: number;
  now: number;
  activationEvent?: EventName;
  funnel?: readonly EventName[];
}

/** Builds the full summary from already-loaded event/error arrays. */
export function summarize(
  events: AnalyticsEvent[],
  errors: ErrorEvent[],
  opts: SummarizeOptions
): MetricsSummary {
  const { now } = opts;
  const windowDays = opts.windowDays ?? 30;
  const activationEvent = opts.activationEvent ?? DEFAULT_ACTIVATION_EVENT;

  const uniqueUsers = new Set(events.map((e) => e.distinctId));
  const activatedUsers = activationFirstSeen(events, activationEvent).size;

  const firstEvent = new Map<string, number>();
  for (const e of events) {
    const p = firstEvent.get(e.distinctId);
    if (p === undefined || e.ts < p) firstEvent.set(e.distinctId, e.ts);
  }
  const newUsers = firstEvent.size;

  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const topEvents = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const tsMap = new Map<string, { events: number; errors: number }>();
  for (let i = windowDays - 1; i >= 0; i--) {
    tsMap.set(dayKey(now - i * DAY_MS), { events: 0, errors: 0 });
  }
  for (const e of events) {
    const b = tsMap.get(dayKey(e.ts));
    if (b) b.events++;
  }
  for (const e of errors) {
    const b = tsMap.get(dayKey(e.ts));
    if (b) b.errors++;
  }
  const timeseries = [...tsMap.entries()].map(([day, v]) => ({ day, ...v }));

  return {
    windowDays,
    generatedAt: now,
    totals: {
      events: events.length,
      uniqueUsers: uniqueUsers.size,
      newUsers,
      activatedUsers,
      activationRate: newUsers > 0 ? activatedUsers / newUsers : 0,
      errors: errors.length,
      errorRate: events.length > 0 ? (errors.length / events.length) * 1000 : 0,
    },
    funnel: computeFunnel(events, opts.funnel),
    retention: computeRetention(events, now, activationEvent),
    topEvents,
    recentErrors: errors.slice(0, 20),
    timeseries,
  };
}
