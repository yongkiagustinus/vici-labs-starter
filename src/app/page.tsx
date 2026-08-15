import Link from "next/link";

const features = [
  {
    title: "Auth included",
    body: "Email + password with signed JWT sessions and route protection. Swap in OAuth when you need it.",
  },
  {
    title: "Billing stub",
    body: "A provider interface with a zero-config stub. Flip an env var to go live with Stripe.",
  },
  {
    title: "App shell",
    body: "Marketing page, auth flow, and an authenticated dashboard — wired and ready.",
  },
  {
    title: "Deploy-ready",
    body: "GitHub Actions CI/CD, a live hello environment, and a Vercel workflow out of the box.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">Vici Labs</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-foreground px-3 py-1.5 text-background"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mt-24">
        <p className="text-sm font-medium uppercase tracking-widest opacity-60">
          Studio starter template
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          Start every new product at 60%, not zero.
        </h1>
        <p className="mt-6 max-w-2xl text-lg opacity-70">
          A niche-agnostic foundation: authentication, billing, an app shell, and
          a working CI/CD pipeline. Clone it, name your product, and ship the part
          that&apos;s actually new.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-foreground px-5 py-3 font-medium text-background"
          >
            Create an account
          </Link>
          <Link
            href="/api/hello"
            className="rounded-md border border-current/20 px-5 py-3 font-medium"
          >
            View /api/hello
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-current/10 p-6"
          >
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 opacity-70">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 border-t border-current/10 pt-8 text-sm opacity-60">
        Vici Labs — reusable product foundation.
      </footer>
    </main>
  );
}
