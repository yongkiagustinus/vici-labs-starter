import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { BILL_RECURRENCES } from "@/lib/db/finance-schema";
import { getFinanceContext } from "@/lib/finance/context";
import { billView } from "@/lib/finance/aggregate";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

/**
 * Edit a bill, or record a payment. To pay: send `payFull: true` (settles the
 * remaining balance) or `payAmount: <minor units>` for a partial payment. When
 * a payment fully covers a recurring bill, the repo rolls the due date forward
 * and resets the paid tally so the next occurrence surfaces in the upcoming
 * view. Everything is scoped to the caller's household.
 */
const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  amount: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().datetime().optional(),
  recurrence: z.enum(BILL_RECURRENCES).optional(),
  reminderLeadDays: z.number().int().min(0).max(60).optional(),
  payFull: z.boolean().optional(),
  payAmount: z.number().int().positive().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }
  const { payFull, payAmount, dueDate, ...fields } = parsed.data;

  // Apply field edits first, if any.
  let bill = null;
  const hasFieldEdit =
    Object.keys(fields).length > 0 || dueDate !== undefined;
  if (hasFieldEdit) {
    bill = await financeRepo.updateBill(ctx.household.id, id, {
      ...fields,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
    });
    if (!bill) return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Then apply a payment, if requested.
  if (payFull || payAmount !== undefined) {
    // For payFull, cover whatever is still outstanding on the current row.
    const current =
      bill ??
      (await financeRepo.listBills(ctx.household.id)).find((b) => b.id === id) ??
      null;
    if (!current) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const amount = payFull
      ? Math.max(0, current.amount - current.paidAmount)
      : payAmount!;
    bill = await financeRepo.payBill(ctx.household.id, id, amount);
    if (!bill) return NextResponse.json({ error: "not found" }, { status: 404 });

    await track("feature_used", {
      userId: ctx.user.id,
      props: { feature: "bill_paid", partial: !payFull },
    });
  }

  if (!bill) {
    // No-op payload: return the current row so the client can refresh.
    bill =
      (await financeRepo.listBills(ctx.household.id)).find((b) => b.id === id) ??
      null;
    if (!bill) return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    bill: { ...bill, schedule: billView(bill, new Date()) },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await financeRepo.deleteBill(ctx.household.id, id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
