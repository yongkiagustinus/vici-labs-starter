import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { getFinanceContext } from "@/lib/finance/context";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z
    .enum(["checking", "savings", "cash", "credit", "investment", "other"])
    .default("checking"),
  currency: z.string().length(3).default("USD"),
  openingBalance: z.number().int().default(0),
});

export async function GET() {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const accounts = await financeRepo.listAccounts(ctx.household.id);
  return NextResponse.json({ accounts });
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

  const account = await financeRepo.createAccount({
    householdId: ctx.household.id,
    authorId: ctx.user.id,
    ...parsed.data,
  });

  await track("feature_used", {
    userId: ctx.user.id,
    props: { feature: "account_created", currency: account.currency },
  });

  return NextResponse.json({ account }, { status: 201 });
}
