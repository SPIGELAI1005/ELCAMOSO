import { useEffect } from "react";

import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/entitlements/catalog";
import { deferSettingsClampUntilDriveEnds } from "@/lib/entitlements/live-drive-access";
import {
  OFFLINE_LEASE_EXPIRY_POLICY,
  resolveOfflineLeaseExpiryAction,
} from "@/lib/entitlements/offline-lease";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import { noteLockedFallback } from "@/lib/entitlements/locked-fallback-notice";
import { useSettings } from "@/lib/drive/useSettings";
import { DEFAULT_SHIFT_FEEL } from "@/lib/drive/types-extra";
import { useSessionStore } from "@/lib/store/session-store";
import { isLiveSessionStatus } from "@/lib/ui/chrome";

function isEntitlementDowngradePatch(
  patch: Record<string, unknown>,
  settings: ReturnType<typeof useSettings>["settings"],
): boolean {
  if ("dynamicDrive" in patch && patch["dynamicDrive"] === false && settings.dynamicDrive) {
    return true;
  }
  if ("latencyCompMs" in patch && patch["latencyCompMs"] === 0 && settings.latencyCompMs !== 0) {
    return true;
  }
  if ("shiftFeel" in patch) return true;
  return false;
}

/** Clamps local settings when server entitlements deny premium features. */
export function EntitlementEnforcer() {
  const { settings, update } = useSettings();
  const access = useFeatureAccess();
  const session = useSessionStore();
  const isLiveDrive = session.kind === "drive" && isLiveSessionStatus(session.status);

  useEffect(() => {
    const leaseAction = resolveOfflineLeaseExpiryAction(Date.now(), settings.accountUserId);
    const mustFadeToFree =
      isLiveDrive &&
      (!access.canDriveWithProfile(settings.profileId) ||
        (leaseAction.expired && OFFLINE_LEASE_EXPIRY_POLICY === "fade_to_free"));

    // Mid-drive fade_to_free applies immediately (quiet profile crossfade). Never defer.
    if (mustFadeToFree && settings.profileId !== FALLBACK_SOUND_PROFILE_ID) {
      if (!access.canDriveWithProfile(settings.profileId)) noteLockedFallback(settings.profileId);
      update({ profileId: leaseAction.fallbackProfileId, shiftMapPreset: "race" });
    }

    const patch: Partial<typeof settings> = {};

    if (settings.dynamicDrive && !access.dynamicDrive) {
      patch.dynamicDrive = false;
    }

    if (!access.advancedControls) {
      if (settings.latencyCompMs !== 0) patch.latencyCompMs = 0;
      if (
        settings.shiftFeel.shiftMs !== DEFAULT_SHIFT_FEEL.shiftMs ||
        settings.shiftFeel.torqueDip !== DEFAULT_SHIFT_FEEL.torqueDip ||
        settings.shiftFeel.revMatch !== DEFAULT_SHIFT_FEEL.revMatch
      ) {
        patch.shiftFeel = DEFAULT_SHIFT_FEEL;
      }
    } else if (!access.revMatch && settings.shiftFeel.revMatch !== DEFAULT_SHIFT_FEEL.revMatch) {
      patch.shiftFeel = { ...settings.shiftFeel, revMatch: DEFAULT_SHIFT_FEEL.revMatch };
    }

    // Outside live Drive, also clamp denied Engine profiles immediately.
    if (
      !isLiveDrive &&
      !access.canDriveWithProfile(settings.profileId) &&
      settings.profileId !== FALLBACK_SOUND_PROFILE_ID
    ) {
      noteLockedFallback(settings.profileId);
      patch.profileId = FALLBACK_SOUND_PROFILE_ID;
      patch.shiftMapPreset = "race";
    }

    if (Object.keys(patch).length === 0) return;

    const apply = () => update(patch);
    if (isLiveDrive && isEntitlementDowngradePatch(patch, settings)) {
      deferSettingsClampUntilDriveEnds(apply);
      return;
    }
    apply();
  }, [
    access.advancedControls,
    access.allSoundProfiles,
    access.dynamicDrive,
    access.revMatch,
    access.canDriveWithProfile,
    isLiveDrive,
    settings.dynamicDrive,
    settings.latencyCompMs,
    settings.profileId,
    settings.shiftFeel,
    settings.accountUserId,
    update,
  ]);

  return null;
}
