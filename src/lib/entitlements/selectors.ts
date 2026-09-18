import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import type { Entitlement } from "@/lib/entitlements/types";
import {
  FALLBACK_SOUND_PROFILE_ID,
  isSoundProfileEntitled,
  isSoundProfilePreviewAllowed,
} from "@/lib/entitlements/catalog";
import { hasEntitlementDuringLiveDriveHold } from "@/lib/entitlements/live-drive-access";
import { getProfile } from "@/lib/sound/profiles";
import { canDriveWithSoundProfile, lockedProfilePreviewSeconds } from "@/lib/sound/profile-access";
import { useSessionStore } from "@/lib/store/session-store";
import { isLiveSessionStatus } from "@/lib/ui/chrome";

/** Single entitlement check - prefer over plan comparisons. */
export function useEntitlement(entitlement: Entitlement): boolean {
  const { hasEntitlement } = useEntitlements();
  return hasEntitlement(entitlement);
}

/** Centralized feature access derived from entitlements only. */
export function useFeatureAccess() {
  const { hasEntitlement, isTrialActive } = useEntitlements();
  const session = useSessionStore();
  const isLiveDrive = session.kind === "drive" && isLiveSessionStatus(session.status);

  const effectiveHas = (entitlement: Entitlement) =>
    hasEntitlement(entitlement) || (isLiveDrive && hasEntitlementDuringLiveDriveHold(entitlement));

  const hasAllSoundProfiles = effectiveHas("all_sound_profiles");

  const canDriveWithProfile = (profileId: string) =>
    canDriveWithSoundProfile(getProfile(profileId), hasAllSoundProfiles);

  const canPreviewProfile = (profileId: string) => isSoundProfilePreviewAllowed(profileId);

  const previewDurationForProfile = (profileId: string) =>
    lockedProfilePreviewSeconds(getProfile(profileId), hasAllSoundProfiles);

  return {
    dynamicDrive: effectiveHas("dynamic_drive"),
    virtualTransmission: effectiveHas("virtual_transmission"),
    revMatch: effectiveHas("rev_match"),
    advancedTransients: effectiveHas("advanced_transients"),
    phoneSensor: effectiveHas("phone_sensor"),
    allSoundProfiles: hasAllSoundProfiles,
    advancedControls: effectiveHas("advanced_controls"),
    symphonyEssential: effectiveHas("symphony_essential"),
    symphonyAll: effectiveHas("symphony_all"),
    worldsSampler: effectiveHas("worlds_sampler"),
    worldsAll: effectiveHas("worlds_all"),
    fusion: effectiveHas("fusion"),
    driveDna: effectiveHas("drive_dna"),
    driveSongBasic: effectiveHas("drive_song_basic"),
    driveSongFull: effectiveHas("drive_song_full"),
    driveReel: effectiveHas("drive_reel"),
    journeyHistoryLocal: effectiveHas("journey_history_local"),
    journeyHistoryFull: effectiveHas("journey_history_full"),
    journeyRemix: effectiveHas("journey_remix"),
    studioSound: effectiveHas("studio_sound"),
    studioSymphony: effectiveHas("studio_symphony"),
    studioFusion: effectiveHas("studio_fusion"),
    experienceDrops: effectiveHas("experience_drops"),
    isTrialActive,
    isLiveDrive,
    canDriveWithProfile,
    canPreviewProfile,
    previewDurationForProfile,
    /** @deprecated Prefer canDriveWithProfile - preview vs drive semantics differ. */
    canUseProfile: (profileId: string) => isSoundProfileEntitled(profileId, hasAllSoundProfiles),
    fallbackProfileId: FALLBACK_SOUND_PROFILE_ID,
  };
}

/** Whether a sound profile can be used for active driving under current entitlements. */
export function useSoundProfileAccess(profileId: string): boolean {
  const { canDriveWithProfile } = useFeatureAccess();
  return canDriveWithProfile(profileId);
}
