import type { Entitlement, EntitlementSnapshot, EntitlementUser, Plan } from "@/lib/entitlements/types";
import { useEntitlementsContext } from "@/lib/entitlements/EntitlementsProvider";

export interface UseEntitlementsResult {
  user: EntitlementUser;
  plan: Plan;
  entitlements: readonly Entitlement[];
  snapshot: EntitlementSnapshot;
  hasEntitlement: (entitlement: Entitlement) => boolean;
  isTrialActive: boolean;
}

/** React hook for feature gates — reads resolved entitlements, never Stripe. */
export function useEntitlements(): UseEntitlementsResult {
  const { user, snapshot, hasEntitlement: check, isTrialActive: trialActive } =
    useEntitlementsContext();

  return {
    user,
    plan: snapshot.plan,
    entitlements: snapshot.entitlements,
    snapshot,
    hasEntitlement: check,
    isTrialActive: trialActive,
  };
}
