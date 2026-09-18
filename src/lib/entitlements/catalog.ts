import { getProfile } from "@/lib/sound/profiles";
import {
  canDriveWithSoundProfile,
  canPreviewSoundProfile,
  FREE_SOUND_PROFILE_IDS,
  resolveProfileAccess,
} from "@/lib/sound/profile-access";

export { FREE_SOUND_PROFILE_IDS };

/** @deprecated Use FREE_SOUND_PROFILE_IDS from profile-access-config. */
export const ESSENTIAL_SOUND_PROFILE_IDS = FREE_SOUND_PROFILE_IDS;

export function isEssentialSoundProfile(profileId: string): boolean {
  return resolveProfileAccess(getProfile(profileId)) === "free";
}

/** Whether the profile can be used during active driving for the current entitlements. */
export function isSoundProfileEntitled(profileId: string, hasAllSoundProfiles: boolean): boolean {
  return canDriveWithSoundProfile(getProfile(profileId), hasAllSoundProfiles);
}

/** Whether a short non-driving preview is allowed (all built-in profiles). */
export function isSoundProfilePreviewAllowed(profileId: string): boolean {
  return canPreviewSoundProfile(profileId);
}

/** First free profile - safe fallback when a Drive+ profile is denied for driving. */
export const FALLBACK_SOUND_PROFILE_ID = FREE_SOUND_PROFILE_IDS[0] ?? "gt-v8";
