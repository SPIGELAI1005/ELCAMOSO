import {
  FALLBACK_SOUND_PROFILE_ID,
  FREE_SOUND_PROFILE_IDS,
  FREE_SOUND_PROFILE_SET,
  LOCKED_PROFILE_PREVIEW_SECONDS,
  isSeasonalFreeProfile,
} from "@/lib/sound/profile-access-config";
import { allSoundsFreeAt } from "@/lib/sound/sound-unlock-flag";

export type SoundProfileAccess = "free" | "drive_plus";

export interface ProfileAccessFields {
  id: string;
  access?: SoundProfileAccess;
  custom?: boolean;
  baseId?: string;
}

const FREE_SET = new Set<string>(FREE_SOUND_PROFILE_IDS);

export function resolveProfileAccess(
  profile: ProfileAccessFields,
  resolveBase?: (baseId: string) => ProfileAccessFields | undefined,
  now?: number,
): SoundProfileAccess {
  // Canonical free trio always wins — profile.access cannot invent extra free IDs.
  if (FREE_SET.has(profile.id)) return "free";
  // Seasonal (Halloween) free window; reverts to Drive+ automatically after it ends.
  if (isSeasonalFreeProfile(profile.id, now)) return "free";
  if (profile.custom && profile.baseId) {
    const base = resolveBase?.(profile.baseId);
    if (base) return resolveProfileAccess(base, resolveBase, now);
  }
  if (profile.access === "drive_plus") return "drive_plus";
  // Ignore access:"free" on IDs outside FREE_SOUND_PROFILE_IDS (closes Symphony/World/Fusion bypass).
  return "drive_plus";
}

export function applyResolvedAccess<T extends ProfileAccessFields>(profile: T): T {
  const access = resolveProfileAccess(profile);
  return profile.access === access ? profile : { ...profile, access };
}

export function applyResolvedAccessToProfiles<T extends ProfileAccessFields>(profiles: T[]): T[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const resolveBase = (baseId: string) => byId.get(baseId);
  return profiles.map((p) => {
    const access = resolveProfileAccess(p, resolveBase);
    return p.access === access ? p : { ...p, access };
  });
}

export function isFreeSoundProfileAccess(access: SoundProfileAccess): boolean {
  return access === "free";
}

export function canDriveWithSoundProfile(
  profile: ProfileAccessFields,
  hasAllSoundProfiles: boolean,
  resolveBase?: (baseId: string) => ProfileAccessFields | undefined,
  /** Purchased / grandfathered / reward profile unlocks (server-authoritative). */
  grantedProfileIds: readonly string[] = [],
  now?: number,
): boolean {
  if (allSoundsFreeAt(now)) return true;
  if (hasAllSoundProfiles) return true;
  if (grantedProfileIds.includes(profile.id)) return true;
  return resolveProfileAccess(profile, resolveBase, now) === "free";
}

/** Non-driving previews are allowed for every built-in profile. */
export function canPreviewSoundProfile(_profileId: string): boolean {
  return true;
}

export function lockedProfilePreviewSeconds(
  profile: ProfileAccessFields,
  hasAllSoundProfiles: boolean,
  resolveBase?: (baseId: string) => ProfileAccessFields | undefined,
  now?: number,
): number | null {
  if (allSoundsFreeAt(now)) return null;
  if (hasAllSoundProfiles) return null;
  if (resolveProfileAccess(profile, resolveBase, now) === "free") return null;
  return LOCKED_PROFILE_PREVIEW_SECONDS;
}

export {
  FALLBACK_SOUND_PROFILE_ID,
  FREE_SOUND_PROFILE_IDS,
  FREE_SOUND_PROFILE_SET,
  LOCKED_PROFILE_PREVIEW_SECONDS,
};
export {
  HALLOWEEN_FREE_PROFILE_IDS,
  HALLOWEEN_PROFILE_IDS,
  HALLOWEEN_WINDOW_END_UTC_MS,
  HALLOWEEN_WINDOW_START_UTC_MS,
  isHalloweenWindow,
  isSeasonalFreeProfile,
} from "@/lib/sound/profile-access-config";
