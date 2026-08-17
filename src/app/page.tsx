import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";

/**
 * Landing page for the first product: a personal expense & bill tracker mobile
 * app (VIC-6 locked scope). The wedge is reliability + household sharing — the
 * two things Pocket Expense 6 users complain about most. Primary conversion is
 * the early-access waitlist (pre app-store launch).
 */

const features = [
  {
    title: "Never lose your data",
    body: "Automatic cloud backup with a restore we actually test. A device reset can't wipe your years of records.",
  },
  {
    title: "Shared with your partner",
    body: "One household, both phones, in near-real-time. Every entry shows who added it — no more “did you log the groceries?”",
  },
  {
    title: "Trust the numbers",
    body: "Uncleared → Cleared → Reconciled on every transaction, plus a reconcile screen. Balances that finally match your bank.",
  },
  {
    title: "Track who owes what",
    body: "Built-in receivables/IOU tracking. Lend a friend money, watch the balance, settle it — without a spreadsheet.",
  },
  {
    title: "Tag the real world",
    body: "Assign spend to a car, a trip, or a kid, then see a report grouped by it. Your money, the way you think about it.",
  },
  {
    title: "Multi-currency, quick add",
    body: "Log any currency, convert on the fly, and add an expense in two taps with a shake-to-add gesture.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">Ledgerly</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
          <a
            href="#waitlist"
            className="rounded-md bg-foreground px-3 py-1.5 text-background"
          >
            Get early access
          </a>
        </nav>
      </header>

      <section className="mt-20">
        <p className="text-sm font-medium uppercase tracking-widest opacity-60">
          Personal expense &amp; bill tracker · iPhone &amp; Android
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          The expense tracker that never loses your data — and finally syncs
          with your partner.
        </h1>
        <p className="mt-6 max-w-2xl text-lg opacity-70">
          Everything you loved about Pocket Expense, plus the things you always
          wished it had: rock-solid backup, real household sync, reconciled
          balances you can trust, and IOU tracking built in.
        </p>
        <div id="waitlist" className="mt-8">
          <WaitlistForm />
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border border-current/10 p-6">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm opacity-70">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-24 rounded-2xl border border-current/10 p-8 text-center">
        <h2 className="text-2xl font-semibold">
          Be first in line when we launch.
        </h2>
        <p className="mx-auto mt-3 max-w-xl opacity-70">
          We&apos;re onboarding early users on iPhone and Android now. Leave your
          email and we&apos;ll send your invite.
        </p>
        <div className="mt-6 flex justify-center">
          <WaitlistForm />
        </div>
      </section>

      <footer className="mt-24 border-t border-current/10 pt-8 text-sm opacity-60">
        Ledgerly — a Vici Labs product. Manual-entry, privacy-first. No bank
        login required.
      </footer>
    </main>
  );
}
