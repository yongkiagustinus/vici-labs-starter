import { getStore } from "./store";
import { summarize, type MetricsSummary } from "./aggregate";
import { DEFAULT_ACTIVATION_EVENT } from "./types";

/**
 * I/O wrapper around the pure aggregation in `aggregate.ts`: loads the window's
 * events/errors from the active store and hands them to `summarize()`.
 */

export type { MetricsSummary } from "./aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVATION_EVENT = process.env.ACTIVATION_EVENT || DEFAULT_ACTIVATION_EVENT;

export interface SummaryOptions {
  windowDays?: number;
  now?: number;
}

/** Loads events/errors for the window and computes the full metrics summary. */
export async function getMetricsSummary(
  opts: SummaryOptions = {}
): Promise<MetricsSummary> {
  const now = opts.now ?? Date.now();
  const windowDays = opts.windowDays ?? 30;
  const since = now - windowDays * DAY_MS;

  const store = getStore();
  const [events, errors] = await Promise.all([
    store.getEvents({ since, until: now }),
    store.getErrors({ since, until: now }),
  ]);

  return summarize(events, errors, {
    windowDays,
    now,
    activationEvent: ACTIVATION_EVENT,
  });
}
