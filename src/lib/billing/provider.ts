/**
 * Billing provider interface.
 *
 * Product code depends ONLY on this interface, never on Stripe (or any vendor)
 * directly. Swap implementations via BILLING_PROVIDER env without touching
 * routes or UI. See `stub.ts` (default) and `stripe.ts` (real).
 */

export interface CheckoutSession {
  /** URL to redirect the customer to in order to complete payment. */
  url: string;
  /** Provider-side session/reference id. */
  id: string;
}

export interface PortalSession {
  /** URL to the customer's self-service billing portal. */
  url: string;
}

export interface BillingProvider {
  readonly name: string;

  /** Start a subscription checkout for a user. */
  createCheckoutSession(input: {
    userId: string;
    email: string;
    /** Where to send the user after success/cancel. */
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;

  /** Create a link to the customer billing/self-service portal. */
  createPortalSession(input: {
    userId: string;
    customerId: string | null;
    returnUrl: string;
  }): Promise<PortalSession>;
}
