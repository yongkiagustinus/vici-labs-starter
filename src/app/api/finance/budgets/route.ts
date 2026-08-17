import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { getFinanceContext } from "@/lib/finance/context";
import {
  budgetProgress,
  monthKey,
  monthRange,
} from "@/lib/finance/aggregate";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const createSchema = z.object({
  category: z.string().min(1).max(100),
  // Monthly limit in minor units (must be positive).
  limitAmount: z.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  // "YYYY-MM" or null/omitted = recurring every month.
  period: z.string().regex(PERIOD_RE).nullish(),
});

/**
 * List budgets with computed spent-vs-limit for a month. Pass `?period=YYYY-MM`
 * (defaults to the current UTC month). Recurring budgets (period=null) are
 * evaluated against the requested month; fixed-month budgets only appear for
 * their own month.
 */
export async function GET(req: Request) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const periodParam = new URL(req.url).searchParams.get("period");
  const period =
    periodParam && PERIOD_RE.test(periodParam)
      ? periodParam
      : monthKey(new Date());

  const { from, to } = monthRange(period);
  const [budgets, txns] = await Promise.all([
    financeRepo.listBudgets(ctx.household.id),
    financeRepo.listTransactions(ctx.household.id, { from, to }),
  ]);

  const progress = budgetProgress(budgets, txns, period);
  return NextResponse.json({ period, budgets, progress });
}

export async function POST(req: Request) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }

  const budget = await financeRepo.createBudget({
    householdId: ctx.household.id,
    authorId: ctx.user.id,
    category: parsed.data.category,
    limitAmount: parsed.data.limitAmount,
    currency: parsed.data.currency,
    period: parsed.data.period ?? null,
  });

  await track("feature_used", {
    userId: ctx.user.id,
    props: { feature: "budget_created", category: budget.category },
  });

  return NextResponse.json({ budget }, { status: 201 });
}
