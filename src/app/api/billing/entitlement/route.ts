import { NextResponse } from "next/server";
import { z } from "zod";
import { billing } from "@/lib/billing";
import { entitlementFromUser } from "@/lib/billing/entitlement";
import { getCurrentUser } from "@/lib/auth";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read the current subscription entitlement for the signed-in user. The mobile
 * paywall calls this on launch and gates premium features on `entitled`.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ entitlement: entitlementFromUser(user) });
}

const verifySchema = z.object({
  platform: z.enum(["ios", "android"]),
  receipt: z.string().min(1),
  productId: z.string().min(1).optional(),
});

/**
 * Verify a StoreKit / Google Play receipt and refresh the entitlement. The
 * mobile client posts here after a successful in-app purchase (and on restore).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = verifySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 }
    );
  }

  const entitlement = await billing().verifyReceipt({
    userId: user.id,
    ...parsed.data,
  });

  await track("feature_used", {
    userId: user.id,
    props: {
      feature: "entitlement_verified",
      platform: parsed.data.platform,
      entitled: entitlement.entitled,
    },
  });

  return NextResponse.json(
    { entitlement },
    { status: entitlement.entitled ? 200 : 402 }
  );
}
