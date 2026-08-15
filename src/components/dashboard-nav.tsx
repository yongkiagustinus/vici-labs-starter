"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function DashboardNav({ email }: { email: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-current/10 px-6 py-4">
      <Link href="/dashboard" className="font-semibold">
        Vici Labs
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="opacity-60">{email}</span>
        <button
          onClick={logout}
          className="rounded-md border border-current/20 px-3 py-1.5"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
