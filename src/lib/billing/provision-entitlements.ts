import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import {
  getSubscriptionForUser,
  setSubscriptionForUser,
  type UserSubscriptionRecord,
} from "@/lib/billing/subscription-store";
import type { Subscription } from "@/lib/billing/types";

function resolvePastDueSince(
  subscription: Subscription,
  existing: UserSubscriptionRecord | null,
): Date | null {
  if (subscription.status !== "past_due") return null;
  if (existing?.status === "past_due" && existing.pastDueSince) {
    return existing.pastDueSince;
  }
  return new Date();
}

/** Mirrors normalized Subscription state into the entitlement runtime store. */
export function provisionEntitlementsFromSubscription(subscription: Subscription): void {
  const existing = getSubscriptionForUser(subscription.userId);
  const record: UserSubscriptionRecord = {
    userId: subscription.userId,
    plan: subscription.plan,
    status: subscription.status,
    interval: subscription.interval,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
    pastDueSince: resolvePastDueSince(subscription, existing),
  };

  if (hasDrivePlusSubscriptionAccess(record)) {
    setSubscriptionForUser({ ...record, plan: "DRIVE_PLUS" });
    return;
  }

  setSubscriptionForUser({
    userId: subscription.userId,
    plan: "FREE",
    status: "free",
    interval: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    pastDueSince: null,
  });
}

export function subscriptionRecordFromUserStore(
  record: UserSubscriptionRecord,
): UserSubscriptionRecord {
  return record;
}
