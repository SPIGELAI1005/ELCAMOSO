import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";
import type { Entitlement } from "@/lib/entitlements/types";

/** Maps server trial snapshot to entitlement grants - not Stripe. */
export function entitlementsFromDynamicDriveTrial(
  snapshot: DynamicDriveTrialSnapshot | null | undefined,
): Entitlement[] {
  if (!snapshot?.canUseDynamicDrive) return [];
  return ["dynamic_drive"];
}
