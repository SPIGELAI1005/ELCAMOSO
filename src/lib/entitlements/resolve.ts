import { entitlementsForPlan } from "@/lib/entitlements/plans";
import { effectiveTrialStatus, isTrialActive } from "@/lib/entitlements/trial";
import type { Entitlement, EntitlementSnapshot, EntitlementUser } from "@/lib/entitlements/types";

/** Resolve the full entitlement set for a user (plan + active trial overlay). */
export function resolveEntitlements(
  user: EntitlementUser,
  now = Date.now(),
): ReadonlySet<Entitlement> {
  const granted = new Set<Entitlement>(entitlementsForPlan(user.plan));
  if (isTrialActive(user, now) && user.trialEntitlements?.length) {
    for (const entitlement of user.trialEntitlements) {
      granted.add(entitlement);
    }
  }
  return granted;
}

/** Check whether a user has a specific entitlement. Never reads Stripe. */
export function hasEntitlement(
  user: EntitlementUser,
  entitlement: Entitlement,
  now = Date.now(),
): boolean {
  return resolveEntitlements(user, now).has(entitlement);
}

/** Snapshot for React subscribers and server responses. */
export function buildEntitlementSnapshot(
  user: EntitlementUser,
  now = Date.now(),
): EntitlementSnapshot {
  const trialActive = isTrialActive(user, now);
  const entitlements = [...resolveEntitlements(user, now)].sort();
  return {
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    trialStatus: effectiveTrialStatus(user, now),
    entitlements,
    trialActive,
    revision: user.revision ?? 0,
  };
}
