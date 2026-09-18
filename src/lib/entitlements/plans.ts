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
  "symphony_essential",
  "symphony_all",
  "worlds_sampler",
  "worlds_all",
  "fusion",
  "drive_dna",
  "drive_song_basic",
  "drive_song_full",
  "drive_reel",
  "journey_history_local",
  "journey_history_full",
  "journey_remix",
  "basic_share",
  "studio_sound",
  "studio_symphony",
  "studio_fusion",
  "premium_presets",
  "experience_drops",
] as const;

export const FREE_ENTITLEMENTS: readonly Entitlement[] = [
  "basic_drive",
  "basic_sound_profiles",
  /** Basic Tesla ↔ phone QR pairing + sensor relay (not premium telemetry). */
  "phone_sensor",
  "symphony_essential",
  "worlds_sampler",
  "drive_dna",
  "drive_song_basic",
  "journey_history_local",
  "basic_share",
  "studio_sound",
] as const;

/** Premium entitlements - everything beyond FREE. */
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
