/**
 * Dependency-free verification of the observability aggregation math.
 *
 * Runs with just Node (TypeScript type-stripping, Node >= 22.6):
 *   node --experimental-strip-types scripts/verify-metrics.mts
 * On Node >= 23.6 the flag is unnecessary: `node scripts/verify-metrics.mts`.
 *
 * Imports only `aggregate.ts`, which has no runtime dependencies, so this
 * verifies the funnel / retention / summary logic without the Next.js/Postgres
 * stack being installed.
 */
import {
  computeFunnel,
  computeRetention,
  summarize,
} from "../src/lib/observability/aggregate.ts";

type Ev = {
  id: string;
  name: string;
  distinctId: string;
  userId?: string | null;
  props: Record<string, unknown>;
  ts: number;
};

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 15, 12, 0, 0); // fixed clock for determinism

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ " + msg);
  } else {
    console.log("  ✓ " + msg);
  }
}
function approx(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

function ev(name: string, distinctId: string, ts: number): Ev {
  return { id: `${name}-${distinctId}-${ts}`, name, distinctId, props: {}, ts };
}

// --- Fixture: 4 users through a funnel, with known retention behavior --------
const events: Ev[] = [];
// u1..u4 all start + complete signup on cohort day (NOW - 7d)
const cohortDay = NOW - 7 * DAY;
for (const u of ["u1", "u2", "u3", "u4"]) {
  events.push(ev("signup_started", u, cohortDay));
  events.push(ev("signup_completed", u, cohortDay + 60_000));
}
// u1,u2,u3 activate that day; u4 never activates
for (const u of ["u1", "u2", "u3"]) events.push(ev("activated", u, cohortDay + 120_000));
// u1 subscribes
events.push(ev("subscribed", "u1", cohortDay + 3 * DAY));
// Retention: u1 returns on D1 and D7; u2 returns on D1 only; u3 never returns
events.push(ev("feature_used", "u1", cohortDay + 1 * DAY));
events.push(ev("feature_used", "u1", cohortDay + 7 * DAY));
events.push(ev("feature_used", "u2", cohortDay + 1 * DAY));

console.log("Funnel:");
const funnel = computeFunnel(events as never);
assert(funnel[0].users === 4, "signup_started = 4 users");
assert(funnel[1].users === 4, "signup_completed = 4 users");
assert(funnel[2].users === 3, "activated = 3 users");
assert(funnel[3].users === 1, "subscribed = 1 user");
assert(approx(funnel[2].overallConversion, 3 / 4), "activated overall conv = 75%");
assert(approx(funnel[3].stepConversion, 1 / 3), "subscribed step conv = 33.3%");

console.log("Retention:");
const ret = computeRetention(events as never, NOW);
const cohort = ret.find((c) => c.size > 0);
assert(!!cohort, "found a non-empty activation cohort");
assert(cohort!.size === 3, "cohort size = 3 activated users");
assert(approx(cohort!.d1, 2 / 3), "D1 retention = 2/3 (u1,u2 returned)");
assert(approx(cohort!.d7, 1 / 3), "D7 retention = 1/3 (u1 returned)");
assert(approx(cohort!.d30, 0), "D30 retention = 0");

console.log("Summary:");
const s = summarize(events as never, [], { now: NOW, windowDays: 30 });
assert(s.totals.newUsers === 4, "newUsers = 4");
assert(s.totals.activatedUsers === 3, "activatedUsers = 3");
assert(approx(s.totals.activationRate, 3 / 4), "activationRate = 75%");
assert(s.totals.errors === 0 && s.totals.errorRate === 0, "no errors -> errorRate 0");
assert(s.totals.events === events.length, "event total matches fixture");
assert(s.topEvents[0].count >= s.topEvents[s.topEvents.length - 1].count, "topEvents sorted desc");
assert(s.timeseries.length === 30, "timeseries has 30 daily buckets");

// error-rate path
const s2 = summarize(events as never, [
  { id: "e1", message: "boom", source: "client", context: {}, ts: NOW - DAY },
] as never, { now: NOW });
assert(s2.totals.errors === 1, "one error counted");
assert(s2.totals.errorRate > 0, "errorRate > 0 when errors present");

console.log(
  failures === 0
    ? "\nALL CHECKS PASSED ✅"
    : `\n${failures} CHECK(S) FAILED ❌`
);
process.exit(failures === 0 ? 0 : 1);
