import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import type { Entitlement } from "@/lib/entitlements/types";
import {
  FALLBACK_SOUND_PROFILE_ID,
  isSoundProfileEntitled,
  isSoundProfilePreviewAllowed,
} from "@/lib/entitlements/catalog";
import { canDriveProfileWithAccess } from "@/lib/entitlements/drive-profile-access";
import { isMusicPackageProfileId } from "@/lib/entitlements/plans";
import {
  grantedProfileIdsDuringLiveDriveHold,
  hasEntitlementDuringLiveDriveHold,
} from "@/lib/entitlements/live-drive-access";
import { getProfile } from "@/lib/sound/profiles";
import { lockedProfilePreviewSeconds } from "@/lib/sound/profile-access";
import { useSessionSelector } from "@/lib/store/session-store";
import { useSyncExternalStore } from "react";
import {
  driveSpecialCapAllows,
  driveSpecialCapGoverns,
  getDriveSpecialCapState,
  subscribeDriveSpecialCap,
} from "@/lib/drive-special-cap/client-store";
import {
  getGuestTrialState,
  guestTrialAllows,
  guestTrialGoverns,
  subscribeGuestTrial,
} from "@/lib/guest-trial/client-store";
import { isLiveSessionStatus } from "@/lib/ui/chrome";

/** Single entitlement check - prefer over plan comparisons. */
export function useEntitlement(entitlement: Entitlement): boolean {
  const { hasEntitlement } = useEntitlements();
  return hasEntitlement(entitlement);
}

/** Centralized feature access derived from entitlements only. */
export function useFeatureAccess() {
  const { hasEntitlement, isTrialActive, user } = useEntitlements();
  // Only kind/status: subscribing to the whole snapshot re-rendered every consumer
  // (root bridges, enforcer, menus) on each RPM tick and starved the car's CPU.
  const session = useSessionSelector((s) => ({ kind: s.kind, status: s.status }));
  const isLiveDrive = session.kind === "drive" && isLiveSessionStatus(session.status);

  const effectiveHas = (entitlement: Entitlement) =>
    hasEntitlement(entitlement) || (isLiveDrive && hasEntitlementDuringLiveDriveHold(entitlement));

  const { snapshot } = useEntitlements();
  const hasAllSoundProfiles = effectiveHas("all_sound_profiles");
  const grantedProfileIds = [
    ...new Set([
      ...snapshot.grantedProfileIds,
      ...(isLiveDrive ? grantedProfileIdsDuringLiveDriveHold() : []),
    ]),
  ];

  const canDriveWithoutGuestTrial = (profileId: string) =>
    canDriveProfileWithAccess({
      profileId,
      hasAllSoundProfiles,
      grantedProfileIds,
      hasEntitlement: effectiveHas,
    });

  // Guest trial: signed-out visitors get 7 free minutes/day on a few sounds
  // (only inside its window). Signed-in accounts are never routed through it.
  const signedIn = Boolean(user?.accountId);
  const guestTrialVersion = useSyncExternalStore(
    subscribeGuestTrial,
    () => getGuestTrialState().version,
    () => 0,
  );
  void guestTrialVersion;
  const capUser = {
    accountId: user?.accountId ?? null,
    plan: snapshot.plan,
    founderDrivePlusActive: Boolean(snapshot.founder?.drivePlusActive),
    grantedEntitlements: user?.grantedEntitlements,
    trialActive: snapshot.trialActive,
    trialEntitlements: user?.trialEntitlements,
    grantedProfileIds: grantedProfileIds,
  };
  const specialCapVersion = useSyncExternalStore(
    subscribeDriveSpecialCap,
    () => getDriveSpecialCapState(user?.accountId ?? "").version,
    () => 0,
  );
  void specialCapVersion;
  const canDriveWithProfile = (profileId: string) => {
    if (guestTrialGoverns(profileId, signedIn)) return guestTrialAllows(profileId, signedIn);
    if (snapshot.driveSpecialCapApplies && driveSpecialCapGoverns(profileId, capUser))
      return driveSpecialCapAllows(profileId, capUser);
    return canDriveWithoutGuestTrial(profileId);
  };
  const isGuestTrialGoverned = (profileId: string) => guestTrialGoverns(profileId, signedIn);
  const isDriveSpecialCapGoverned = (profileId: string) =>
    Boolean(snapshot.driveSpecialCapApplies) && driveSpecialCapGoverns(profileId, capUser);

  const canPreviewProfile = (profileId: string) => isSoundProfilePreviewAllowed(profileId);

  const previewDurationForProfile = (profileId: string) =>
    lockedProfilePreviewSeconds(
      getProfile(profileId),
      isMusicPackageProfileId(profileId) ? canDriveWithProfile(profileId) : hasAllSoundProfiles,
    );

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
    canDriveWithoutGuestTrial,
    isSignedIn: signedIn,
    isGuestTrialGoverned,
    isDriveSpecialCapGoverned,
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
