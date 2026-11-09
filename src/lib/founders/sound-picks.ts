/**
 * Founders Pack forever-sound picks: 4 catalog sounds from Drive+ and/or
 * Drive the Music. Globally free sounds cannot be picked and do not count.
 */
import { isMusicPackageProfileId } from "@/lib/entitlements/plans";
import { FOUNDER_FOREVER_PICK_LIMIT } from "@/lib/founders/founders";
import { resolveProfileAccess } from "@/lib/sound/profile-access";
import { SOUND_PROFILES, type SoundProfile } from "@/lib/sound/profiles";

export interface FounderPickOption {
  id: string;
  name: string;
  library: "drive_plus" | "drive_music";
  category: string;
}

export interface FounderPickCounter {
  selected: number;
  left: number;
  limit: number;
  label: string;
}

export function catalogProfileById(profileId: string): SoundProfile | undefined {
  return SOUND_PROFILES.find((p) => p.id === profileId);
}

export function catalogProfileExists(profileId: string): boolean {
  return Boolean(catalogProfileById(profileId));
}

/** True when everyone can drive this profile for free right now (catalog free flag). */
export function isGloballyFreeSound(profileId: string, now = Date.now()): boolean {
  const profile = catalogProfileById(profileId);
  if (!profile) return false;
  return resolveProfileAccess(profile, undefined, now) === "free";
}

/** A picked id still counts toward the 4 if it exists and is not globally free. */
export function isFounderPickStillValid(profileId: string, now = Date.now()): boolean {
  return catalogProfileExists(profileId) && !isGloballyFreeSound(profileId, now);
}

export function isFounderPickable(profileId: string, now = Date.now()): boolean {
  return isFounderPickStillValid(profileId, now);
}

export function listFounderPickOptions(now = Date.now()): FounderPickOption[] {
  return SOUND_PROFILES.filter((p) => isFounderPickable(p.id, now)).map((p) => ({
    id: p.id,
    name: p.name,
    library: isMusicPackageProfileId(p.id) ? "drive_music" : "drive_plus",
    category: p.category,
  }));
}

export function validFounderPickIds(soundIds: readonly string[], now = Date.now()): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of soundIds) {
    if (!id || seen.has(id)) continue;
    if (!isFounderPickStillValid(id, now)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function founderPickCounter(
  soundIds: readonly string[],
  now = Date.now(),
  language = "en",
): FounderPickCounter {
  const selected = validFounderPickIds(soundIds, now).length;
  const left = Math.max(0, FOUNDER_FOREVER_PICK_LIMIT - selected);
  return {
    selected,
    left,
    limit: FOUNDER_FOREVER_PICK_LIMIT,
    label: founderPickCounterLabel(selected, left, language),
  };
}

export function founderPickCounterLabel(selected: number, left: number, language = "en"): string {
  const key = language.slice(0, 2).toLowerCase();
  if (key === "de") return `${selected} von 4 gewählt, ${left} übrig`;
  if (key === "ro") return `${selected} din 4 selectate, ${left} rămase`;
  return `${selected} of 4 selected, ${left} left`;
}

export function canConfirmFounderPicks(soundIds: readonly string[], now = Date.now()): boolean {
  return validFounderPickIds(soundIds, now).length === FOUNDER_FOREVER_PICK_LIMIT;
}
