"use client";

import { useState } from "react";

export function BillingPanel({ status }: { status: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const isActive = status === "active";

  async function go(path: "checkout" | "portal") {
    setLoading(path);
    try {
      const res = await fetch(`/api/billing/${path}`, { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-current/10 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Billing</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isActive
              ? "bg-green-500/15 text-green-600"
              : "bg-current/10 opacity-70"
          }`}
        >
          {isActive ? "Active" : "Free"}
        </span>
      </div>
      <p className="mt-2 opacity-70">
        {isActive
          ? "Your subscription is active. Manage it in the billing portal."
          : "You're on the free plan. Upgrade to unlock the full product."}
      </p>
      <div className="mt-4 flex gap-3">
        {isActive ? (
          <button
            onClick={() => go("portal")}
            disabled={loading !== null}
            className="rounded-md border border-current/20 px-4 py-2 font-medium disabled:opacity-50"
          >
            {loading === "portal" ? "Opening…" : "Manage billing"}
          </button>
        ) : (
          <button
            onClick={() => go("checkout")}
            disabled={loading !== null}
            className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
          >
            {loading === "checkout" ? "Redirecting…" : "Upgrade"}
          </button>
        )}
      </div>
    </div>
  );
}
