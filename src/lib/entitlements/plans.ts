import type { Entitlement, Plan } from "@/lib/entitlements/types";

/** Canonical entitlement list (v1). */
export const ALL_ENTITLEMENTS: readonly Entitlement[] = [
  "basic_drive",
  "basic_sound_profiles",
  "dynamic_drive",
  "virtual_transmission",
  "rev_match",
  "advanced_transients",
  "phone_sensor",
  "all_sound_profiles",
  "advanced_controls",
  "vehicle_telemetry",
] as const;

export const FREE_ENTITLEMENTS: readonly Entitlement[] = [
  "basic_drive",
  "basic_sound_profiles",
  /** Basic Tesla ↔ phone QR pairing + sensor relay (not premium telemetry). */
  "phone_sensor",
] as const;

/** Premium entitlements — everything beyond FREE. */
export const PREMIUM_ENTITLEMENTS: readonly Entitlement[] = ALL_ENTITLEMENTS.filter(
  (e) => !FREE_ENTITLEMENTS.includes(e),
);

/** Plan → entitlement configuration (single source of truth). */
export const PLAN_ENTITLEMENTS: Record<Plan, readonly Entitlement[]> = {
  FREE: FREE_ENTITLEMENTS,
  DRIVE_PLUS: ALL_ENTITLEMENTS,
};

export function entitlementsForPlan(plan: Plan): readonly Entitlement[] {
  return PLAN_ENTITLEMENTS[plan];
}

/** Default trial grant: full DRIVE+ capability on FREE base plan. */
export const TRIAL_DRIVE_PLUS_ENTITLEMENTS: readonly Entitlement[] = PREMIUM_ENTITLEMENTS;
