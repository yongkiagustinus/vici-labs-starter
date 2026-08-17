import { NextResponse } from "next/server";
import { getMetricsSummary } from "@/lib/observability/metrics";
import { isProd } from "@/lib/env";

/**
 * Machine-readable metrics feed (same data as the /metrics view).
 *
 * Internal-only: in production it requires a bearer token (METRICS_TOKEN) so it
 * isn't publicly scrapable. In dev it's open for convenience.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const token = process.env.METRICS_TOKEN;
  if (!isProd) return true; // open in dev
  if (!token) return false; // fail closed in prod if unconfigured
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${token}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const windowDays = Math.min(
    365,
    Math.max(1, Number(url.searchParams.get("windowDays")) || 30)
  );
  const summary = await getMetricsSummary({ windowDays });
  return NextResponse.json(summary, {
    headers: { "cache-control": "no-store" },
  });
}
