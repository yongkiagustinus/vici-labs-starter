import type {
  FunnelStep,
  MetricsSummary,
  RetentionCohort,
} from "@/lib/observability/aggregate";
import type { ErrorEvent } from "@/lib/observability/types";

/**
 * Presentational components for the internal metrics view. Pure server-render:
 * inline SVG + inline styles so the dashboard renders identically regardless of
 * the host app's CSS setup, and reads cleanly in light or dark mode.
 *
 * Palette: one calm blue for volume/positive series, amber for mid-funnel,
 * semantic red reserved for errors — chosen for AA contrast on both themes.
 */

const C = {
  bar: "#3b82f6",
  barMuted: "#93c5fd",
  amber: "#f59e0b",
  error: "#ef4444",
  gridText: "color-mix(in srgb, currentColor 55%, transparent)",
  cardBg: "color-mix(in srgb, currentColor 4%, transparent)",
  cardBorder: "color-mix(in srgb, currentColor 14%, transparent)",
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString("en-US");

function Card({
  title,
  children,
  span = 1,
}: {
  title?: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <section
      style={{
        gridColumn: `span ${span}`,
        border: `1px solid ${C.cardBorder}`,
        background: C.cardBg,
        borderRadius: 12,
        padding: 16,
      }}
    >
      {title && (
        <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, opacity: 0.8 }}>
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "error";
}) {
  return (
    <Card>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          marginTop: 4,
          color: tone === "error" ? C.error : "inherit",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>{hint}</div>}
    </Card>
  );
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.users));
  return (
    <Card title="Activation & conversion funnel" span={2}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s, i) => {
          const w = (s.users / max) * 100;
          return (
            <div key={s.name}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {num(s.users)} · {pct(s.overallConversion)} of top
                  {i > 0 && ` · ${pct(s.stepConversion)} step`}
                </span>
              </div>
              <div
                style={{
                  height: 18,
                  borderRadius: 6,
                  marginTop: 4,
                  background: "color-mix(in srgb, currentColor 8%, transparent)",
                }}
                role="img"
                aria-label={`${s.name}: ${s.users} users, ${pct(s.overallConversion)} of funnel top`}
              >
                <div
                  style={{
                    width: `${w}%`,
                    height: "100%",
                    borderRadius: 6,
                    background: i === steps.length - 1 ? C.amber : C.bar,
                    minWidth: s.users > 0 ? 2 : 0,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function RetentionTable({ cohorts }: { cohorts: RetentionCohort[] }) {
  const rows = cohorts.filter((c) => c.size > 0).slice(-10);
  return (
    <Card title="Retention by activation cohort (D1 / D7 / D30)" span={2}>
      {rows.length === 0 ? (
        <Empty>No activated cohorts in this window yet.</Empty>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.7 }}>
              <th style={{ padding: "4px 8px" }}>Cohort</th>
              <th style={{ padding: "4px 8px" }}>Size</th>
              <th style={{ padding: "4px 8px" }}>D1</th>
              <th style={{ padding: "4px 8px" }}>D7</th>
              <th style={{ padding: "4px 8px" }}>D30</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.day} style={{ borderTop: `1px solid ${C.cardBorder}` }}>
                <td style={{ padding: "4px 8px", fontVariantNumeric: "tabular-nums" }}>{c.day}</td>
                <td style={{ padding: "4px 8px" }}>{num(c.size)}</td>
                <RetCell v={c.d1} />
                <RetCell v={c.d7} />
                <RetCell v={c.d30} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function RetCell({ v }: { v: number }) {
  return (
    <td style={{ padding: "4px 8px" }}>
      <span
        style={{
          display: "inline-block",
          minWidth: 44,
          textAlign: "center",
          borderRadius: 6,
          padding: "2px 6px",
          fontVariantNumeric: "tabular-nums",
          background: `color-mix(in srgb, ${C.bar} ${Math.round(v * 60)}%, transparent)`,
        }}
      >
        {pct(v)}
      </span>
    </td>
  );
}

export function TrendChart({ series }: { series: MetricsSummary["timeseries"] }) {
  const w = 640;
  const h = 120;
  const pad = 8;
  const maxE = Math.max(1, ...series.map((d) => d.events));
  const barW = series.length > 0 ? (w - pad * 2) / series.length : 0;
  return (
    <Card title="Daily events & errors" span={2}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Daily event and error volume">
        {series.map((d, i) => {
          const x = pad + i * barW;
          const eh = (d.events / maxE) * (h - pad * 2);
          const erh = (d.errors / maxE) * (h - pad * 2);
          return (
            <g key={d.day}>
              <rect
                x={x + 1}
                y={h - pad - eh}
                width={Math.max(1, barW - 2)}
                height={eh}
                fill={C.barMuted}
                rx={1}
              >
                <title>{`${d.day}: ${d.events} events`}</title>
              </rect>
              {d.errors > 0 && (
                <rect
                  x={x + 1}
                  y={h - pad - erh}
                  width={Math.max(1, barW - 2)}
                  height={erh}
                  fill={C.error}
                  rx={1}
                >
                  <title>{`${d.day}: ${d.errors} errors`}</title>
                </rect>
              )}
            </g>
          );
        })}
      </svg>
    </Card>
  );
}

export function ErrorFeed({ errors }: { errors: ErrorEvent[] }) {
  return (
    <Card title="Recent errors" span={2}>
      {errors.length === 0 ? (
        <Empty>No errors captured in this window. 🎉</Empty>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {errors.map((e) => (
            <li key={e.id} style={{ borderTop: `1px solid ${C.cardBorder}`, paddingTop: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: `color-mix(in srgb, ${C.error} 18%, transparent)`,
                    color: C.error,
                    fontWeight: 600,
                  }}
                >
                  {e.source}
                </span>
                <code style={{ fontSize: 12, wordBreak: "break-word" }}>{e.message}</code>
              </div>
              <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                {e.path ?? "—"} · {new Date(e.ts).toISOString().replace("T", " ").slice(0, 19)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, opacity: 0.6, padding: "8px 0" }}>{children}</div>;
}

export { Card };
