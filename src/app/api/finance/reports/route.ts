import { NextResponse } from "next/server";
import { financeRepo } from "@/lib/db/finance-repo";
import { getFinanceContext } from "@/lib/finance/context";
import {
  reportByAssignee,
  reportByCategory,
  reportByContributor,
  reportByTime,
} from "@/lib/finance/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROUPINGS = ["category", "time", "contributor", "assignee"] as const;
type Grouping = (typeof GROUPINGS)[number];
const BUCKETS = ["day", "week", "month"] as const;

/**
 * Aggregation/reports API. Slices the household's transactions along one
 * dimension:
 *   - `?groupBy=category`     — spend/income per category
 *   - `?groupBy=time&bucket=` — per day/week/month time bucket (default month)
 *   - `?groupBy=contributor`  — per author (per-record attribution)
 *   - `?groupBy=assignee`     — per object/person (`assignedTo`)
 * Optionally bound the window with `?from=<ISO>&to=<ISO>` (to is exclusive).
 * Each group reports inflow, outflow, net, and count in minor units.
 */
export async function GET(req: Request) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const groupBy = (params.get("groupBy") ?? "category") as Grouping;
  if (!GROUPINGS.includes(groupBy)) {
    return NextResponse.json(
      { error: `groupBy must be one of: ${GROUPINGS.join(", ")}` },
      { status: 400 }
    );
  }
  const bucketParam = params.get("bucket") ?? "month";
  const bucket = (BUCKETS as readonly string[]).includes(bucketParam)
    ? (bucketParam as (typeof BUCKETS)[number])
    : "month";

  const fromParam = params.get("from");
  const toParam = params.get("to");
  const from = fromParam ? new Date(fromParam) : undefined;
  const to = toParam ? new Date(toParam) : undefined;
  if ((from && isNaN(from.getTime())) || (to && isNaN(to.getTime()))) {
    return NextResponse.json(
      { error: "from/to must be ISO date strings" },
      { status: 400 }
    );
  }

  const txns = await financeRepo.listTransactions(ctx.household.id, {
    from,
    to,
  });

  const groups =
    groupBy === "category"
      ? reportByCategory(txns)
      : groupBy === "time"
        ? reportByTime(txns, bucket)
        : groupBy === "contributor"
          ? reportByContributor(txns)
          : reportByAssignee(txns);

  const totals = groups.reduce(
    (acc, g) => ({
      inflow: acc.inflow + g.inflow,
      outflow: acc.outflow + g.outflow,
      net: acc.net + g.net,
      count: acc.count + g.count,
    }),
    { inflow: 0, outflow: 0, net: 0, count: 0 }
  );

  return NextResponse.json({
    groupBy,
    ...(groupBy === "time" ? { bucket } : {}),
    window: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    totals,
    groups,
  });
}
