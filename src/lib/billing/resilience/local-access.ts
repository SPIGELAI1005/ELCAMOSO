import {
  evaluateSubscriptionAccess,
  hasDrivePlusSubscriptionAccess,
} from "@/lib/billing/subscription-access-policy";
import {
  getSubscriptionForUser,
  type UserSubscriptionRecord,
} from "@/lib/billing/subscription-store";

/** Entitlement gates read this in-memory store only - never Stripe. */
export function resolveLocalSubscriptionAccess(
  userId: string,
  now = Date.now(),
): {
  record: UserSubscriptionRecord | null;
  hasDrivePlusAccess: boolean;
  reason: ReturnType<typeof evaluateSubscriptionAccess>["reason"];
} {
  const record = getSubscriptionForUser(userId);
  if (!record) {
    return { record: null, hasDrivePlusAccess: false, reason: "free" };
  }
  const decision = evaluateSubscriptionAccess(record, now);
  return {
    record,
    hasDrivePlusAccess: decision.hasDrivePlusAccess,
    reason: decision.reason,
  };
}

export function userHasLocalDrivePlusAccess(userId: string, now = Date.now()): boolean {
  const record = getSubscriptionForUser(userId);
  if (!record) return false;
  return hasDrivePlusSubscriptionAccess(record, now);
}
