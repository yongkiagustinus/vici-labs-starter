import { getCurrentUser } from "@/lib/auth";
import { BillingPanel } from "@/components/billing-panel";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome{user?.name ? `, ${user.name}` : ""} 👋
        </h1>
        <p className="mt-1 opacity-70">
          This is your authenticated app shell. Build your product here.
        </p>
      </div>

      <BillingPanel status={user?.billingStatus ?? "free"} />

      <div className="rounded-xl border border-current/10 p-6">
        <h2 className="text-lg font-semibold">Next steps</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 opacity-70">
          <li>Add your product tables to <code>src/lib/db/schema.ts</code>.</li>
          <li>Replace this dashboard with your core product surface.</li>
          <li>Flip <code>BILLING_PROVIDER=stripe</code> when you&apos;re ready to charge.</li>
          <li>Set repo secrets and deploy to Vercel via the included workflow.</li>
        </ul>
      </div>
    </div>
  );
}
