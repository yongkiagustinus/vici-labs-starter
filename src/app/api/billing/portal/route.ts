import { NextResponse } from "next/server";
import { billing } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await billing().createPortalSession({
    userId: user.id,
    customerId: user.billingCustomerId,
    returnUrl: `${env.appUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
