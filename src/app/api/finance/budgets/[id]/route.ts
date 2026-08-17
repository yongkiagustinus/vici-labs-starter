import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { getFinanceContext } from "@/lib/finance/context";

export const runtime = "nodejs";

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const patchSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  limitAmount: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  period: z.string().regex(PERIOD_RE).nullish(),
});

/** Edit a budget's category / limit / period. Scoped to the household. */
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

  const budget = await financeRepo.updateBudget(ctx.household.id, id, parsed.data);
  if (!budget) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ budget });
}

/** Soft-delete a budget. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await financeRepo.deleteBudget(ctx.household.id, id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
