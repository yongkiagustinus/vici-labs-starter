import { env } from "@/lib/env";
import type { BillingProvider } from "./provider";
import { StubBillingProvider } from "./stub";
import { StripeBillingProvider } from "./stripe";

/** Resolve the active billing provider from env (defaults to the stub). */
let _provider: BillingProvider | null = null;

export function billing(): BillingProvider {
  if (!_provider) {
    _provider =
      env.billing.provider === "stripe"
        ? new StripeBillingProvider()
        : new StubBillingProvider();
  }
  return _provider;
}

export type { BillingProvider } from "./provider";
