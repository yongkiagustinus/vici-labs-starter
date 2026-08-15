import { NextResponse } from "next/server";
import { z } from "zod";
import { usersRepo } from "@/lib/db/users-repo";
import { hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { email, password, name } = parsed.data;

  const existing = await usersRepo.findByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  const user = await usersRepo.create({
    email,
    name: name ?? null,
    passwordHash: await hashPassword(password),
  });
  await startSession(user);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
}
