import { usersRepo } from "@/lib/db/users-repo";
import type { BillingProvider } from "./provider";

/**
 * StubBillingProvider — the default. Requires NO Stripe account or keys.
 *
 * "Checkout" immediately marks the user active and redirects to a local
 * confirmation page, so the whole billing flow is clickable end-to-end while
 * you build. Replace with the Stripe provider when you're ready to charge.
 */
export class StubBillingProvider implements BillingProvider {
  readonly name = "stub";

  async createCheckoutSession(input: {
    userId: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    // Simulate a successful subscription without any external call.
    await usersRepo.setBilling(input.userId, {
      billingCustomerId: `stub_cus_${input.userId}`,
      billingStatus: "active",
    });
    return {
      id: `stub_cs_${Date.now()}`,
      url: input.successUrl,
    };
  }

  async createPortalSession(input: {
    userId: string;
    customerId: string | null;
    returnUrl: string;
  }) {
    // No real portal in stub mode — bounce straight back.
    return { url: input.returnUrl };
  }
}
