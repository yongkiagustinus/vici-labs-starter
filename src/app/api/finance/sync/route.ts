import { NextResponse } from "next/server";
import { financeRepo } from "@/lib/db/finance-repo";
import { getFinanceContext } from "@/lib/finance/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Delta-sync endpoint — the backbone the mobile client polls (or long-polls) to
 * stay in near-real-time sync with the household. Pass `?since=<cursor>` (epoch
 * ms from the previous pull; omit or 0 for a full snapshot). The response echoes
 * a fresh `cursor` and every account/transaction — including soft-deleted
 * tombstones — changed strictly after it, so offline edits reconcile without
 * ever dropping data (the "never lose your data" wedge).
 */
export async function GET(req: Request) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sinceParam = new URL(req.url).searchParams.get("since");
  const since = Math.max(0, Number(sinceParam) || 0);

  const delta = await financeRepo.changesSince(ctx.household.id, since);
  const memberIds = await financeRepo.listMemberIds(ctx.household.id);

  return NextResponse.json({
    householdId: ctx.household.id,
    memberIds,
    ...delta,
    serverTime: Date.now(),
  });
}
