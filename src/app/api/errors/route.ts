import { NextResponse } from "next/server";
import { captureError, getOrCreateDistinctId } from "@/lib/observability/analytics";
import { errorReportSchema } from "@/lib/observability/types";

/**
 * Client error-report ingestion. The AnalyticsProvider's global handlers and
 * the <ErrorBoundary> POST here. Server-side errors call captureError() directly.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = errorReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid report", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const distinctId = await getOrCreateDistinctId();
  await captureError({
    message: parsed.data.message,
    stack: parsed.data.stack ?? null,
    source: parsed.data.source,
    path: parsed.data.path ?? null,
    distinctId,
    context: parsed.data.context ?? {},
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
