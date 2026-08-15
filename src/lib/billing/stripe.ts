import { env } from "@/lib/env";
import type { BillingProvider } from "./provider";

/**
 * StripeBillingProvider — a real implementation sketch using Stripe's REST API
 * (no SDK dependency needed). Enable with BILLING_PROVIDER=stripe and the
 * STRIPE_* env vars. Wire your webhook to update `billingStatus` on the user.
 *
 * This is intentionally minimal: it creates real Checkout/Portal sessions but
 * leaves subscription lifecycle (webhooks) as a documented TODO so you fill in
 * exactly what your product needs.
 */
export class StripeBillingProvider implements BillingProvider {
  readonly name = "stripe";

  private async stripe(path: string, body: Record<string, string>) {
    if (!env.billing.stripeSecretKey) {
      throw new Error(
        "BILLING_PROVIDER=stripe but STRIPE_SECRET_KEY is not set."
      );
    }
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.billing.stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
    });
    if (!res.ok) {
      throw new Error(`Stripe API error ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  async createCheckoutSession(input: {
    userId: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    if (!env.billing.stripePriceId) {
      throw new Error("STRIPE_PRICE_ID is not set.");
    }
    const session = await this.stripe("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": env.billing.stripePriceId,
      "line_items[0][quantity]": "1",
      customer_email: input.email,
      client_reference_id: input.userId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    return { id: session.id as string, url: session.url as string };
  }

  async createPortalSession(input: {
    userId: string;
    customerId: string | null;
    returnUrl: string;
  }) {
    if (!input.customerId) {
      throw new Error("No Stripe customer id on user — subscribe first.");
    }
    const session = await this.stripe("billing_portal/sessions", {
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url as string };
  }
}
