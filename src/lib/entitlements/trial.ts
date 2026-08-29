import type { EntitlementUser, TrialStatus } from "@/lib/entitlements/types";

/** Whether the user's trial overlay is currently active. */
export function isTrialActive(user: EntitlementUser, now = Date.now()): boolean {
  if (user.trialStatus !== "active") return false;
  if (user.trialEndsAt != null && user.trialEndsAt <= now) return false;
  return true;
}

/** Effective trial status after evaluating expiry (does not mutate user). */
export function effectiveTrialStatus(user: EntitlementUser, now = Date.now()): TrialStatus {
  if (user.trialStatus === "none") return "none";
  if (user.trialStatus === "expired") return "expired";
  if (user.trialEndsAt != null && user.trialEndsAt <= now) return "expired";
  return "active";
}
