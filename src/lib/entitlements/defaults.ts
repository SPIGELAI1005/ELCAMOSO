import type { EntitlementUser } from "@/lib/entitlements/types";

/** Anonymous default — FREE tier, no billing dependency. */
export const DEFAULT_ENTITLEMENT_USER: EntitlementUser = {
  accountId: null,
  plan: "FREE",
  subscriptionStatus: "none",
  trialStatus: "none",
  trialEntitlements: undefined,
  trialEndsAt: null,
  revision: 0,
};
