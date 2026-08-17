import { NextResponse } from "next/server";
import { track } from "@/lib/observability/analytics";
import { getOrCreateDistinctId } from "@/lib/observability/analytics";
import { trackEventSchema } from "@/lib/observability/types";

/**
 * Analytics ingestion endpoint. The client SDK (AnalyticsProvider) POSTs here.
 * Server time is authoritative; the anonymous distinctId is bound to an
 * httpOnly cookie so funnels/retention survive across sessions.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = trackEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid event", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const distinctId = parsed.data.distinctId ?? (await getOrCreateDistinctId());
  await track(parsed.data.name, {
    distinctId,
    userId: parsed.data.userId ?? null,
    props: parsed.data.props ?? {},
  });

  // 202: accepted for processing; analytics must never block the caller.
  return NextResponse.json({ ok: true, distinctId }, { status: 202 });
}
