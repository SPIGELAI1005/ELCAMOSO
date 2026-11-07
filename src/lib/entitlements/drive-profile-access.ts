import { canAccessExperience } from "@/lib/experiences/access";
import { experienceForProfileId } from "@/lib/experiences/catalog";
import { entitlementsForPlan, isMusicPackageProfileId } from "@/lib/entitlements/plans";
import { allSoundsFreeAt } from "@/lib/sound/sound-unlock-flag";
import type { Entitlement } from "@/lib/entitlements/types";
import { canDriveWithSoundProfile, FREE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-access";
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
  // Music profiles (Drive the Music package): Drive+ (all_sound_profiles) never unlocks them.
  if (isMusicPackageProfileId(input.profileId)) {
    if (FREE_SET.has(input.profileId)) return true;
    if (input.grantedProfileIds.includes(input.profileId)) return true;
    if (allSoundsFreeAt()) return true;
    const experience = experienceForProfileId(input.profileId);
    if (experience.kind === "engine" || !experience.capabilities.selectableInDrive) return false;
    const required = experience.capabilities.requiredEntitlement;
    // Free-sampler music profiles (locked after the sound gate) need the package itself.
    if (!required || entitlementsForPlan("FREE").includes(required)) {
      return input.hasEntitlement(
        input.profileId.startsWith("fusion-") ? "fusion" : "symphony_all",
      );
    }
    return canAccessExperience(experience, input.hasEntitlement);
  }
  if (
    canDriveWithSoundProfile(profile, input.hasAllSoundProfiles, undefined, input.grantedProfileIds)
  ) {
    return true;
  }

  if (FREE_SET.has(input.profileId)) return true;

  if (!isExperienceProfileId(input.profileId)) return false;

  const experience = experienceForProfileId(input.profileId);
  if (experience.kind === "engine") return false;
  if (!experience.capabilities.selectableInDrive) return false;
  // Free tier = the three free engine profiles only: free-plan experience
  // entitlements (symphony_essential / worlds_sampler) do not unlock driving.
  const required = experience.capabilities.requiredEntitlement;
  if (!required || entitlementsForPlan("FREE").includes(required)) return false;
  return canAccessExperience(experience, input.hasEntitlement);
}
