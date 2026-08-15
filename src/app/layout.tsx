import type { Metadata } from "next";
import "./globals.css";
import { AnalyticsProvider } from "@/components/observability";

export const metadata: Metadata = {
  title: "Vici Labs Starter",
  description:
    "Niche-agnostic studio starter template — auth, billing, and app shell, ready to build on.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Auto-captures page_view + client errors for the observability layer. */}
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}
