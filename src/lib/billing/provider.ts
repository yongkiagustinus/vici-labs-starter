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

/** Mobile store platforms whose in-app-purchase receipts we verify. */
export type StorePlatform = "ios" | "android";

/**
 * The subscription entitlement the mobile paywall reads. `entitled` is the
 * single boolean the client gates premium features on; the rest is context for
 * UI (renewal date, which product, where the grant came from).
 */
export interface Entitlement {
  entitled: boolean;
  /** free | active | expired | grace — mirrors the user's billingStatus. */
  status: string;
  productId: string | null;
  platform: StorePlatform | "web" | null;
  /** ISO expiry of the current period, when known. */
  expiresAt: string | null;
  /** Which provider produced this entitlement (e.g. "stub", "app_store"). */
  source: string;
}

export interface VerifyReceiptInput {
  userId: string;
  platform: StorePlatform;
  /** Base64 App Store receipt, or a Google Play purchase token. */
  receipt: string;
  /** The product/subscription id the receipt is expected to unlock. */
  productId?: string;
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

  /**
   * Verify a StoreKit / Google Play receipt and, on success, persist the
   * resulting entitlement on the user so the mobile paywall (and the
   * entitlement endpoint) reflect it. Returns the entitlement either way — an
   * invalid receipt yields `{ entitled: false }` rather than throwing.
   */
  verifyReceipt(input: VerifyReceiptInput): Promise<Entitlement>;
}
