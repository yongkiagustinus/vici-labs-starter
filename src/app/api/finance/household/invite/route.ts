import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { env } from "@/lib/env";
import { getFinanceContext } from "@/lib/finance/context";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

const createSchema = z.object({
  // Optionally pin the invite to a specific email; omit for a shareable link.
  email: z.string().email().max(320).nullish(),
  role: z.enum(["member", "owner"]).default("member"),
  // Optional custom lifetime in days (1–30); defaults to the repo's 7 days.
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

function joinUrl(token: string) {
  return `${env.appUrl}/join?token=${encodeURIComponent(token)}`;
}

/** List outstanding + past invites for the household. */
export async function GET() {
  const ctx = await getFinanceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const invites = await financeRepo.listInvites(ctx.household.id);
  return NextResponse.json({
    invites: invites.map((i) => ({ ...i, joinUrl: joinUrl(i.token) })),
  });
}

/** Mint an invite token so a partner can join the household. */
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

  const invite = await financeRepo.createInvite({
    householdId: ctx.household.id,
    invitedBy: ctx.user.id,
    email: parsed.data.email ?? null,
    role: parsed.data.role,
    ttlMs: parsed.data.expiresInDays
      ? parsed.data.expiresInDays * 24 * 60 * 60 * 1000
      : undefined,
  });

  await track("feature_used", {
    userId: ctx.user.id,
    props: { feature: "household_invite_created", role: invite.role },
  });

  return NextResponse.json(
    { invite: { ...invite, joinUrl: joinUrl(invite.token) } },
    { status: 201 }
  );
}
