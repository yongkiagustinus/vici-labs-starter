import { NextResponse } from "next/server";
import { z } from "zod";
import { financeRepo } from "@/lib/db/finance-repo";
import { getCurrentUser } from "@/lib/auth";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

const joinSchema = z.object({ token: z.string().min(1) });

const ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  expired: 410,
  already_used: 409,
  already_member: 409,
};

/**
 * Redeem a household invite token: the signed-in user is added to the inviting
 * household as a member. Single-use — the token is consumed on success. This is
 * the multi-user completion: a partner installs the app, signs up, and joins
 * the shared household so both sync against the same data.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = joinSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }

  const result = await financeRepo.acceptInvite(parsed.data.token, user.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: ERROR_STATUS[result.error] ?? 400 }
    );
  }

  const memberIds = await financeRepo.listMemberIds(result.household.id);

  await track("feature_used", {
    userId: user.id,
    props: { feature: "household_joined" },
  });

  return NextResponse.json({ household: result.household, memberIds });
}
