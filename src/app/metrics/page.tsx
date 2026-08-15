import { getMetricsSummary } from "@/lib/observability/metrics";
import {
  StatTile,
  FunnelChart,
  RetentionTable,
  TrendChart,
  ErrorFeed,
} from "@/components/observability/metrics-ui";

/**
 * Internal metrics view.
 *
 * A simple, self-contained dashboard so the team can see how a product is doing
 * at a glance: activation, retention, funnel conversion, and error health.
 *
 * Reads directly from the observability store (in-memory in dev, Postgres in
 * prod). Protect this route behind admin/staff auth in production — see the
 * README "Securing the metrics view" note.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString("en-US");

export default async function MetricsPage() {
  const m = await getMetricsSummary({ windowDays: 30 });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Product metrics</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.65 }}>
          Last {m.windowDays} days · generated{" "}
          {new Date(m.generatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <StatTile
          label="Activation rate"
          value={pct(m.totals.activationRate)}
          hint={`${num(m.totals.activatedUsers)} of ${num(m.totals.newUsers)} new users`}
        />
        <StatTile label="New users" value={num(m.totals.newUsers)} hint="first seen in window" />
        <StatTile label="Unique users" value={num(m.totals.uniqueUsers)} hint={`${num(m.totals.events)} events`} />
        <StatTile
          label="Errors"
          value={num(m.totals.errors)}
          hint={`${m.totals.errorRate.toFixed(2)} / 1k events`}
          tone={m.totals.errors > 0 ? "error" : "default"}
        />

        <TrendChart series={m.timeseries} />
        <FunnelChart steps={m.funnel} />
        <RetentionTable cohorts={m.retention} />
        <ErrorFeed errors={m.recentErrors} />
      </div>

      <footer style={{ marginTop: 20, fontSize: 12, opacity: 0.5 }}>
        Top events:{" "}
        {m.topEvents.length
          ? m.topEvents.map((e) => `${e.name} (${num(e.count)})`).join(" · ")
          : "none yet"}
      </footer>
    </main>
  );
}
