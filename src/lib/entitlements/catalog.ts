import { getProfile } from "@/lib/sound/profiles";
import {
  canDriveWithSoundProfile,
  canPreviewSoundProfile,
  FREE_SOUND_PROFILE_IDS,
  resolveProfileAccess,
} from "@/lib/sound/profile-access";
import { FALLBACK_SOUND_PROFILE_ID as FREE_FALLBACK } from "@/lib/sound/profile-access-config";

export { FREE_SOUND_PROFILE_IDS };
export { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";

/** @deprecated Use FREE_SOUND_PROFILE_IDS from profile-access-config. */
export const ESSENTIAL_SOUND_PROFILE_IDS = FREE_SOUND_PROFILE_IDS;

export function isEssentialSoundProfile(profileId: string): boolean {
  return resolveProfileAccess(getProfile(profileId)) === "free";
}

/** Whether the profile can be used during active driving for the current entitlements. */
export function isSoundProfileEntitled(
  profileId: string,
  hasAllSoundProfiles: boolean,
  grantedProfileIds: readonly string[] = [],
): boolean {
  return canDriveWithSoundProfile(
    getProfile(profileId),
    hasAllSoundProfiles,
    undefined,
    grantedProfileIds,
  );
}

/** Whether a short non-driving preview is allowed (all built-in profiles). */
export function isSoundProfilePreviewAllowed(profileId: string): boolean {
  return canPreviewSoundProfile(profileId);
}

/** @deprecated Prefer FALLBACK_SOUND_PROFILE_ID from profile-access-config. */
export const LEGACY_FALLBACK_SOUND_PROFILE_ID = FREE_FALLBACK;
