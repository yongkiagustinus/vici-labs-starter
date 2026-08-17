import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { TRANSACTION_STATUSES } from "@/lib/db/finance-schema";
import { getFinanceContext } from "@/lib/finance/context";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

/**
 * Edit a transaction, advance its reconciliation status
 * (uncleared → cleared → reconciled), settle an IOU, or soft-delete it.
 * Scoped to the caller's household; app-level integrity, no cross-tenant leak.
 */
const patchSchema = z.object({
  amount: z.number().int().optional(),
  payee: z.string().max(200).nullish(),
  category: z.string().max(100).nullish(),
  note: z.string().max(2000).nullish(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  assignedTo: z.string().max(120).nullish(),
  settleIou: z.boolean().optional(),
  deleted: z.boolean().optional(),
  occurredAt: z.string().datetime().optional(),
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
  const { settleIou, deleted, occurredAt, ...rest } = parsed.data;

  const updated = await financeRepo.updateTransaction(ctx.household.id, id, {
    ...rest,
    ...(occurredAt ? { occurredAt: new Date(occurredAt) } : {}),
    ...(settleIou !== undefined
      ? { iouSettled: settleIou ? new Date() : null }
      : {}),
    ...(deleted !== undefined
      ? { deletedAt: deleted ? new Date() : null }
      : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (rest.status) {
    await track("feature_used", {
      userId: ctx.user.id,
      props: { feature: "reconcile", status: rest.status },
    });
  }

  return NextResponse.json({ transaction: updated });
}
