import { env } from "@/lib/env";
import type { Entitlement, VerifyReceiptInput } from "./provider";

/**
 * Mobile store receipt verification — StoreKit (App Store) and Google Play.
 *
 * This is deliberately vendor-direct rather than routed through Stripe: web
 * subscriptions (Stripe) and mobile in-app purchases are separate rails, and
 * Apple/Google are the source of truth for IAP entitlements. The Stripe billing
 * provider delegates here for `verifyReceipt` so product code still depends only
 * on the `BillingProvider` interface.
 *
 * Both paths are real calls, env-gated: without the store credentials they
 * return a not-entitled result with a clear reason instead of throwing, so the
 * app boots and the paywall simply stays locked.
 */

const APPLE_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

function notEntitled(reason: string): Entitlement {
  return {
    entitled: false,
    status: "free",
    productId: null,
    platform: null,
    expiresAt: null,
    source: reason,
  };
}

/** Verify an App Store receipt via Apple's verifyReceipt endpoint. */
async function verifyApple(input: VerifyReceiptInput): Promise<Entitlement> {
  if (!env.billing.appleSharedSecret) {
    return notEntitled("app_store_unconfigured");
  }
  const body = JSON.stringify({
    "receipt-data": input.receipt,
    password: env.billing.appleSharedSecret,
    "exclude-old-transactions": true,
  });
  const post = (url: string) =>
    fetch(url, { method: "POST", body }).then((r) => r.json());

  // Apple asks clients to try prod first and retry sandbox on 21007.
  let data = await post(APPLE_PROD);
  if (data?.status === 21007) data = await post(APPLE_SANDBOX);
  if (data?.status !== 0) {
    return notEntitled(`app_store_status_${data?.status ?? "unknown"}`);
  }

  const latest: Array<Record<string, string>> =
    data.latest_receipt_info ?? [];
  // Pick the receipt with the furthest-future expiry.
  const best = latest
    .map((r) => ({
      productId: r.product_id,
      expiresMs: Number(r.expires_date_ms ?? 0),
    }))
    .sort((a, b) => b.expiresMs - a.expiresMs)[0];
  const entitled = !!best && best.expiresMs > Date.now();
  return {
    entitled,
    status: entitled ? "active" : "expired",
    productId: best?.productId ?? input.productId ?? null,
    platform: "ios",
    expiresAt: best?.expiresMs ? new Date(best.expiresMs).toISOString() : null,
    source: "app_store",
  };
}

/** Verify a Google Play purchase token via the Android Publisher API. */
async function verifyGoogle(input: VerifyReceiptInput): Promise<Entitlement> {
  const { googlePlayAccessToken, androidPackageName } = env.billing;
  if (!googlePlayAccessToken || !androidPackageName || !input.productId) {
    return notEntitled("play_unconfigured");
  }
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${encodeURIComponent(androidPackageName)}/purchases/subscriptions/` +
    `${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.receipt)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${googlePlayAccessToken}` },
  });
  if (!res.ok) return notEntitled(`play_status_${res.status}`);
  const data = await res.json();
  const expiresMs = Number(data.expiryTimeMillis ?? 0);
  const entitled = expiresMs > Date.now();
  return {
    entitled,
    status: entitled ? "active" : "expired",
    productId: input.productId,
    platform: "android",
    expiresAt: expiresMs ? new Date(expiresMs).toISOString() : null,
    source: "play",
  };
}

/** Verify a store receipt, dispatching by platform. Never throws. */
export async function verifyStoreReceipt(
  input: VerifyReceiptInput
): Promise<Entitlement> {
  try {
    return input.platform === "ios"
      ? await verifyApple(input)
      : await verifyGoogle(input);
  } catch (err) {
    return notEntitled(
      `verify_error_${err instanceof Error ? err.name : "unknown"}`
    );
  }
}
