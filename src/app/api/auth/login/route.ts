import { NextResponse } from "next/server";
import { z } from "zod";
import { usersRepo } from "@/lib/db/users-repo";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await usersRepo.findByEmail(email);
  // Constant-ish response: don't reveal whether the email exists.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  await startSession(user);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
}
