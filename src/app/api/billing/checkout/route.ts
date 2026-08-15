import { NextResponse } from "next/server";
import { billing } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await billing().createCheckoutSession({
    userId: user.id,
    email: user.email,
    successUrl: `${env.appUrl}/dashboard?checkout=success`,
    cancelUrl: `${env.appUrl}/dashboard?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
