export type {
  Entitlement,
  EntitlementSnapshot,
  EntitlementUser,
  Plan,
  SubscriptionStatus,
  TrialStatus,
} from "@/lib/entitlements/types";

export {
  ALL_ENTITLEMENTS,
  FREE_ENTITLEMENTS,
  PLAN_ENTITLEMENTS,
  PREMIUM_ENTITLEMENTS,
  TRIAL_DRIVE_PLUS_ENTITLEMENTS,
  entitlementsForPlan,
} from "@/lib/entitlements/plans";

export {
  FREE_SOUND_PROFILE_IDS,
  FALLBACK_SOUND_PROFILE_ID,
  isEssentialSoundProfile,
  isSoundProfileEntitled,
  isSoundProfilePreviewAllowed,
} from "@/lib/entitlements/catalog";

export { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";

export { effectiveTrialStatus, isTrialActive } from "@/lib/entitlements/trial";

export {
  buildEntitlementSnapshot,
  hasEntitlement,
  resolveEntitlements,
} from "@/lib/entitlements/resolve";

export {
  EntitlementDeniedError,
  requireEntitlement,
  resolveEntitlementSnapshot,
  resolveEntitlementUser,
  trialGrantsDrivePlusEntitlements,
} from "@/lib/entitlements/service";

export { getEntitlementsFn } from "@/lib/entitlements/server-fns";
export { assertServerEntitlement } from "@/lib/entitlements/server-assert";

export {
  EntitlementsContext,
  EntitlementsProvider,
  type EntitlementsContextValue,
  type EntitlementsProviderProps,
} from "@/lib/entitlements/EntitlementsProvider";

export { useEntitlements, type UseEntitlementsResult } from "@/lib/entitlements/useEntitlements";

export { EntitlementGate } from "@/lib/entitlements/EntitlementGate";

export {
  useEntitlement,
  useFeatureAccess,
  useSoundProfileAccess,
} from "@/lib/entitlements/selectors";

export { entitlementsFromDynamicDriveTrial } from "@/lib/entitlements/dynamic-drive-trial";
