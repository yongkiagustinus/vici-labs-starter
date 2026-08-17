import type { User } from "@/lib/db/schema";
import type { Entitlement } from "./provider";

/** Billing statuses that unlock premium features. */
export const ENTITLED_STATUSES = ["active", "grace", "trialing"] as const;

/** True when the user's billing snapshot grants premium access. */
export function isEntitled(status: string): boolean {
  return (ENTITLED_STATUSES as readonly string[]).includes(status);
}

/**
 * Derive the paywall entitlement from the user's persisted billing snapshot.
 * This is the read path the mobile app hits on launch; receipt verification is
 * the write path that keeps `billingStatus` current.
 */
export function entitlementFromUser(user: User): Entitlement {
  return {
    entitled: isEntitled(user.billingStatus),
    status: user.billingStatus,
    productId: null,
    platform: null,
    expiresAt: null,
    source: "user_record",
  };
}
