import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import {
  TRANSACTION_KINDS,
  TRANSACTION_STATUSES,
} from "@/lib/db/finance-schema";
import { getFinanceContext } from "@/lib/finance/context";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

const createSchema = z.object({
  accountId: z.string().min(1),
  // Signed minor units (cents): negative = out, positive = in.
  amount: z.number().int(),
  currency: z.string().length(3).default("USD"),
  payee: z.string().max(200).nullish(),
  category: z.string().max(100).nullish(),
  note: z.string().max(2000).nullish(),
  status: z.enum(TRANSACTION_STATUSES).default("uncleared"),
  kind: z.enum(TRANSACTION_KINDS).default("expense"),
  assignedTo: z.string().max(120).nullish(),
  iouPerson: z.string().max(200).nullish(),
  iouDirection: z.enum(["lent", "borrowed"]).nullish(),
  occurredAt: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam) || 0, 500) : undefined;
  const transactions = await financeRepo.listTransactions(ctx.household.id, {
    limit,
  });
  return NextResponse.json({ transactions });
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
  const { occurredAt, ...rest } = parsed.data;

  const transaction = await financeRepo.createTransaction({
    householdId: ctx.household.id,
    authorId: ctx.user.id,
    ...rest,
    occurredAt: occurredAt ? new Date(occurredAt) : undefined,
  });

  await track("feature_used", {
    userId: ctx.user.id,
    props: { feature: "transaction_added", kind: transaction.kind },
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
