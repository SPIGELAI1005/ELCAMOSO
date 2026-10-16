import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import {
  getSubscriptionForUser,
  setSubscriptionForUser,
  type UserSubscriptionRecord,
} from "@/lib/billing/subscription-store";
import type { Subscription } from "@/lib/billing/types";
import {
  getUnderlyingSubscriptionRecord,
  hasActiveLifetimeGrant,
  isLifetimeProviderId,
  lifetimeEntitlementRecord,
  setUnderlyingSubscriptionRecord,
} from "@/lib/billing/lifetime-store";

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
  if (isLifetimeProviderId(subscription.providerSubscriptionId)) {
    if (subscription.status === "active") {
      setSubscriptionForUser(lifetimeEntitlementRecord(subscription.userId));
      return;
    }
    // Lifetime refunded/revoked - fall back to any recurring subscription state.
    const underlying = getUnderlyingSubscriptionRecord(subscription.userId);
    if (underlying && hasDrivePlusSubscriptionAccess(underlying)) {
      setSubscriptionForUser({ ...underlying, plan: "DRIVE_PLUS" });
      return;
    }
    setFree(subscription.userId);
    return;
  }

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
  setUnderlyingSubscriptionRecord(record);

  // A lifetime grant outranks any recurring subscription state (e.g. cancellation).
  if (hasActiveLifetimeGrant(subscription.userId)) {
    setSubscriptionForUser(lifetimeEntitlementRecord(subscription.userId));
    return;
  }

  if (hasDrivePlusSubscriptionAccess(record)) {
    setSubscriptionForUser({ ...record, plan: "DRIVE_PLUS" });
    return;
  }

  setFree(subscription.userId);
}

function setFree(userId: string): void {
  setSubscriptionForUser({
    userId,
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
