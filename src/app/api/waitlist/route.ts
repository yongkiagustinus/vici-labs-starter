import { NextResponse } from "next/server";
import { z } from "zod";
import { waitlistRepo } from "@/lib/db/waitlist-repo";
import { track } from "@/lib/observability/analytics";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  platform: z.enum(["ios", "android", "any"]).optional(),
  source: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Enter a valid email" },
      { status: 400 }
    );
  }

  const { email, platform, source } = parsed.data;
  const { created } = await waitlistRepo.add({
    email,
    platform: platform ?? "any",
    source: source ?? "landing",
  });

  // Conversion event — proves the analytics pipeline is flowing from the
  // landing page (VIC-7 "confirm analytics are flowing").
  await track("signup_started", {
    props: { via: "waitlist", platform: platform ?? "any", newSignup: created },
  });

  return NextResponse.json({ ok: true, created }, { status: created ? 201 : 200 });
}
