import { evaluateSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";

import type { RewardAudience } from "./types";

/**
 * Paid pool when the account currently has Drive Plus access
 * (active / trialing / past-due grace / cancel-at-period-end).
 * Otherwise free pool. Never trusts client-reported plan.
 */
export function resolveRewardAudience(accountId: string, nowMs: number = Date.now()): RewardAudience {
  const subscription = getSubscriptionForUser(accountId);
  if (!subscription) return "free";
  const decision = evaluateSubscriptionAccess(
    {
      plan: subscription.plan,
      status: subscription.status,
      ...(subscription.cancelAtPeriodEnd !== undefined
        ? { cancelAtPeriodEnd: subscription.cancelAtPeriodEnd }
        : {}),
      ...(subscription.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: subscription.currentPeriodEnd }
        : {}),
      pastDueSince: subscription.pastDueSince ?? null,
    },
    nowMs,
  );
  return decision.hasDrivePlusAccess ? "paid" : "free";
}
