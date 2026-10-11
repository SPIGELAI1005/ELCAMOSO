import { canAccessExperience } from "@/lib/experiences/access";
import { experienceForProfileId } from "@/lib/experiences/catalog";
import type { Entitlement } from "@/lib/entitlements/types";
import {
  canDriveWithSoundProfile,
  FREE_SOUND_PROFILE_IDS,
} from "@/lib/sound/profile-access";
import { getProfile } from "@/lib/sound/profiles";

const FREE_SET = new Set(FREE_SOUND_PROFILE_IDS);

function isExperienceProfileId(profileId: string): boolean {
  return (
    profileId.startsWith("symphony-") ||
    profileId.startsWith("fusion-") ||
    profileId.startsWith("world-")
  );
}

/**
 * Authoritative Drive/Sounds selection gate:
 * free trio ∪ grants ∪ all_sound_profiles ∪ experience entitlement for Symphony/World/Fusion IDs.
 */
export function canDriveProfileWithAccess(input: {
  profileId: string;
  hasAllSoundProfiles: boolean;
  grantedProfileIds: readonly string[];
  hasEntitlement: (entitlement: Entitlement) => boolean;
}): boolean {
  const profile = getProfile(input.profileId);
  if (
    canDriveWithSoundProfile(
      profile,
      input.hasAllSoundProfiles,
      undefined,
      input.grantedProfileIds,
    )
  ) {
    return true;
  }

  if (FREE_SET.has(input.profileId)) return true;

  if (!isExperienceProfileId(input.profileId)) return false;

  const experience = experienceForProfileId(input.profileId);
  if (experience.kind === "engine") return false;
  if (!experience.capabilities.selectableInDrive) return false;
  return canAccessExperience(experience, input.hasEntitlement);
}
