"use client";

import { useState } from "react";
import { useAnalytics } from "@/components/observability/analytics-provider";

/**
 * Early-access capture for the pre-launch landing page. Posts to /api/waitlist
 * (which persists + fires the server-side conversion event) and also emits a
 * client `feature_used` event so the funnel is visible in the metrics view.
 */
export function WaitlistForm({ platform }: { platform?: "ios" | "android" }) {
  const { track } = useAnalytics();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, platform: platform ?? "any" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Something went wrong. Try again.");
        return;
      }
      track("feature_used", { feature: "waitlist_submitted" });
      setState("done");
      setMessage("You're on the list — we'll email your early-access invite.");
      setEmail("");
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
        ✅ {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="min-w-0 flex-1 rounded-md border border-current/20 bg-transparent px-4 py-3"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="rounded-md bg-foreground px-5 py-3 font-medium text-background disabled:opacity-60"
        >
          {state === "loading" ? "…" : "Get early access"}
        </button>
      </div>
      {message && state === "error" && (
        <p className="text-sm text-red-500">{message}</p>
      )}
      <p className="text-xs opacity-60">
        iPhone &amp; Android at launch. No spam — just your invite.
      </p>
    </form>
  );
}
