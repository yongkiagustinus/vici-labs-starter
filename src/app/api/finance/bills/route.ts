import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { BILL_RECURRENCES } from "@/lib/db/finance-schema";
import { getFinanceContext } from "@/lib/finance/context";
import { billView } from "@/lib/finance/aggregate";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  dueDate: z.string().datetime(),
  recurrence: z.enum(BILL_RECURRENCES).default("monthly"),
  reminderLeadDays: z.number().int().min(0).max(60).default(3),
});

/**
 * List bills, each decorated with a computed schedule view (status, amount
 * outstanding, reminder timestamp for client push scheduling). Filter with
 * `?view=upcoming|overdue|paid|due_soon`; omit for all. Bills are returned in
 * due-date order.
 */
export async function GET(req: Request) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const view = new URL(req.url).searchParams.get("view");
  const now = new Date();
  const rows = await financeRepo.listBills(ctx.household.id);
  let bills = rows.map((bill) => ({ ...bill, schedule: billView(bill, now) }));
  if (view) bills = bills.filter((b) => b.schedule.status === view);

  return NextResponse.json({
    bills,
    serverTime: now.getTime(),
    counts: {
      overdue: bills.filter((b) => b.schedule.status === "overdue").length,
      dueSoon: bills.filter((b) => b.schedule.status === "due_soon").length,
    },
  });
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
  const { dueDate, ...rest } = parsed.data;

  const bill = await financeRepo.createBill({
    householdId: ctx.household.id,
    authorId: ctx.user.id,
    ...rest,
    dueDate: new Date(dueDate),
  });

  await track("feature_used", {
    userId: ctx.user.id,
    props: { feature: "bill_created", recurrence: bill.recurrence },
  });

  return NextResponse.json(
    { bill: { ...bill, schedule: billView(bill, new Date()) } },
    { status: 201 }
  );
}
