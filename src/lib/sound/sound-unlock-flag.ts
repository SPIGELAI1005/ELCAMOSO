import type { Entitlement } from "@/lib/entitlements/types";

/**
 * TEMPORARY TESTING SWITCH — unlocks every Sound Profile, World, Symphony and
 * Fusion sound on the free tier (Tesla road test, Oct 2026).
 *
 * Drive+ data is untouched: profiles keep `access: "drive_plus"` in source,
 * billing / checkout / Stripe flows are unchanged. Only the access resolvers
 * honour this flag.
 *
 * Default OFF so production serves the permanent free trio only. Set Vercel
 * env `VITE_UNLOCK_ALL_SOUNDS=true` (or `1`) to re-enable for road testing.
 * Delete this file and its call sites in profile-access.ts / access-resolver.ts
 * when the switch is no longer needed.
 */
const raw: string | undefined = import.meta.env["VITE_UNLOCK_ALL_SOUNDS"];

export const UNLOCK_ALL_SOUNDS_FOR_TESTING: boolean =
  raw == null || raw === "" ? false : raw !== "false" && raw !== "0";

/** Sound-content entitlements granted to everyone while the switch is on. */
export const TESTING_UNLOCKED_SOUND_ENTITLEMENTS: readonly Entitlement[] = [
  "basic_sound_profiles",
  "all_sound_profiles",
  "symphony_essential",
  "symphony_all",
  "worlds_sampler",
  "worlds_all",
  "fusion",
];
