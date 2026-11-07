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
  /**
   * Motion-matched gear shifts (PowertrainSimulator) for every virtual-transmission
   * Sound Profile the user can drive. Rev-match, overrun/turbo transients and shift-feel
   * tuning stay in Drive+ (`dynamic_drive`, `rev_match`, `advanced_transients`).
   */
  "virtual_transmission",
  /** Basic Tesla ↔ phone QR pairing + sensor relay (not premium telemetry). */
  "phone_sensor",
  "symphony_essential",
  "drive_dna",
  "journey_history_local",
  "studio_sound",
] as const;

/** Premium entitlements - everything beyond FREE. */
export const PREMIUM_ENTITLEMENTS: readonly Entitlement[] = ALL_ENTITLEMENTS.filter(
  (e) => !FREE_ENTITLEMENTS.includes(e),
);

/**
 * "Drive the Music" package: every music profile / Symphony genre (incl. Auto DJ,
 * which plays the Symphony genres), music Studio and Fusion (machine meets music).
 */
export const DRIVE_MUSIC_PACKAGE_ENTITLEMENTS: readonly Entitlement[] = [
  "symphony_all",
  "studio_symphony",
  "fusion",
  "studio_fusion",
] as const;

/** Drive+ package: every premium entitlement that is not music. */
export const DRIVE_PLUS_PACKAGE_ENTITLEMENTS: readonly Entitlement[] = PREMIUM_ENTITLEMENTS.filter(
  (e) => !DRIVE_MUSIC_PACKAGE_ENTITLEMENTS.includes(e),
);

/** Plan → entitlement configuration (single source of truth). */
export const PLAN_ENTITLEMENTS: Record<Plan, readonly Entitlement[]> = {
  FREE: FREE_ENTITLEMENTS,
  DRIVE_PLUS: [...FREE_ENTITLEMENTS, ...DRIVE_PLUS_PACKAGE_ENTITLEMENTS],
  DRIVE_MUSIC: [...FREE_ENTITLEMENTS, ...DRIVE_MUSIC_PACKAGE_ENTITLEMENTS],
  DRIVE_COMPLETE: ALL_ENTITLEMENTS,
};

export type PackageId = "drive_plus" | "drive_music";

/** Which packages a plan contains. */
export function packagesForPlan(plan: Plan): readonly PackageId[] {
  switch (plan) {
    case "DRIVE_PLUS":
      return ["drive_plus"];
    case "DRIVE_MUSIC":
      return ["drive_music"];
    case "DRIVE_COMPLETE":
      return ["drive_plus", "drive_music"];
    default:
      return [];
  }
}

/**
 * Profile ids that belong to the "Drive the Music" package (Symphony genres incl.
 * Auto DJ, and Fusion). Engine profiles and Worlds stay in Drive+.
 */
export function isMusicPackageProfileId(profileId: string): boolean {
  return profileId.startsWith("symphony-") || profileId.startsWith("fusion-");
}

export function isPaidPlan(plan: Plan): boolean {
  return plan !== "FREE";
}

export function entitlementsForPlan(plan: Plan): readonly Entitlement[] {
  return PLAN_ENTITLEMENTS[plan];
}

/** Default trial grant: full DRIVE+ capability on FREE base plan. */
export const TRIAL_DRIVE_PLUS_ENTITLEMENTS: readonly Entitlement[] = PREMIUM_ENTITLEMENTS;
