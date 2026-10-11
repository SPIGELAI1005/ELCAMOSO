import {
  resolveEffectiveEntitlements,
  type AccessResolverInput,
} from "@/lib/entitlements/access-resolver";
import { entitlementsForPlan } from "@/lib/entitlements/plans";
import { effectiveTrialStatus, isTrialActive } from "@/lib/entitlements/trial";
import type { Entitlement, EntitlementSnapshot, EntitlementUser } from "@/lib/entitlements/types";

function toResolverInput(user: EntitlementUser, now: number): AccessResolverInput {
  return {
    user,
    grantedProfileIds: user.grantedProfileIds ?? [],
    grantedEntitlements: user.grantedEntitlements ?? [],
    now,
  };
}

/**
 * Resolve the full entitlement set for a user.
 * Uses the Prompt 11 access resolver (plan + trial + grants + subscription status).
 */
export function resolveEntitlements(
  user: EntitlementUser,
  now = Date.now(),
): ReadonlySet<Entitlement> {
  return resolveEffectiveEntitlements(toResolverInput(user, now));
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
  offlineLeaseExpiresAt: number | null = null,
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
    grantedProfileIds: [...(user.grantedProfileIds ?? [])].sort(),
    offlineLeaseExpiresAt,
  };
}

/** Plan-only entitlements without trial/grants — testing helper. */
export function entitlementsForPlanOnly(plan: EntitlementUser["plan"]): readonly Entitlement[] {
  return entitlementsForPlan(plan);
}
