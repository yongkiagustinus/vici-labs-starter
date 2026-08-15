import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Middleware already guards this, but double-check for the full-user object.
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <DashboardNav email={user.email} />
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
