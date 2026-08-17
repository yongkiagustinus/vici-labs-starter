import { NextResponse } from "next/server";
import { financeRepo } from "@/lib/db/finance-repo";
import { getFinanceContext } from "@/lib/finance/context";

export const runtime = "nodejs";

/** The caller's household + member ids (multi-user surface). */
export async function GET() {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memberIds = await financeRepo.listMemberIds(ctx.household.id);
  return NextResponse.json({ household: ctx.household, memberIds });
}
