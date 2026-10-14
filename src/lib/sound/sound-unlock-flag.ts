import type { Entitlement } from "@/lib/entitlements/types";

/**
 * TEMPORARY TESTING SWITCH — unlocks every Sound Profile, World, Symphony and
 * Fusion sound on the free tier (Tesla road test, Oct 2026).
 *
 * Drive+ data is untouched: profiles keep `access: "drive_plus"` in source,
 * billing / checkout / Stripe flows are unchanged. Only the access resolvers
 * honour this flag.
 *
 * TODO(revert after Tesla test): set Vercel env `VITE_UNLOCK_ALL_SOUNDS=false`
 * and redeploy, or change the default below to `false` (then delete this file
 * and its two call sites in profile-access.ts / access-resolver.ts).
 */
const raw: string | undefined = import.meta.env["VITE_UNLOCK_ALL_SOUNDS"];

export const UNLOCK_ALL_SOUNDS_FOR_TESTING: boolean =
  raw == null || raw === "" ? true : raw !== "false" && raw !== "0";

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
