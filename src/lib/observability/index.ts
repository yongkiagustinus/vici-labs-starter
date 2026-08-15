/**
 * Observability layer — product analytics, error monitoring, and metrics.
 *
 * Server usage:
 *   import { track, captureError } from "@/lib/observability";
 *   await track("activated", { userId });
 *
 * Client usage: use the <AnalyticsProvider> + useAnalytics() hook and
 * <ErrorBoundary> from "@/components/observability".
 *
 * See src/lib/observability/README.md for wiring + the metrics view.
 */
export { track, captureError, getOrCreateDistinctId, ANON_COOKIE } from "./analytics";
export { getMetricsSummary } from "./metrics";
export { getStore } from "./store";
export type { ObservabilityStore, EventQuery } from "./store";
export type {
  AnalyticsEvent,
  ErrorEvent,
  EventName,
  CoreEventName,
} from "./types";
export {
  CORE_EVENTS,
  DEFAULT_ACTIVATION_EVENT,
  DEFAULT_FUNNEL,
  trackEventSchema,
  errorReportSchema,
} from "./types";
export type {
  MetricsSummary,
  FunnelStep,
  RetentionCohort,
} from "./aggregate";
