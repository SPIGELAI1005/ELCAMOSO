/**
 * Sounds dropdown: live search + "7 Days Drive Special" pinning (George, 3 Nov 2026).
 * Pure helpers, no React, so they are unit-tested.
 */
import { isMusicPackageProfileId } from "@/lib/entitlements/plans";
import { DRIVE_SPECIAL_COMPANION_IDS } from "@/lib/billing/drive-special";
import {
  DRIVE_SPECIAL_EXCLUDED_IDS,
  DRIVE_SPECIAL_GENRE_HOST_ID,
  DRIVE_SPECIAL_GENRE_ITEMS,
  driveSpecialGenreItem,
} from "@/lib/billing/drive-special-genres";

/** Lowercase, strip diacritics (ă â î ș ț ä ö ü ß …) and collapse spaces. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** DE / RO search labels per category (and a few common words in names). */
const CATEGORY_LABELS: Record<string, string[]> = {
  Classic: ["klassisch", "clasic"],
  Motorsport: ["rennsport", "motorsport", "curse"],
  Future: ["zukunft", "viitor"],
  Nautical: ["boot", "schiff", "nautic", "barca", "vapor"],
  Aviation: ["luftfahrt", "flugzeug", "aviatie", "avion"],
  Machines: ["maschinen", "masini", "utilaje"],
  Nature: ["natur", "natura"],
  Heritage: ["tradition", "erbe", "traditie", "mostenire"],
  Musical: ["musik", "muzica", "musical"],
  Festive: ["festlich", "weihnachten", "festiv", "craciun"],
  Playful: ["verspielt", "lustig", "jucaus", "amuzant"],
};
const WORD_LABELS: Record<string, string[]> = {
  carriage: ["kutsche", "trasura", "caruta"],
  police: ["polizei", "politie"],
  horse: ["pferd", "cal"],
  train: ["zug", "eisenbahn", "tren"],
  boat: ["boot", "barca"],
  rocket: ["rakete", "racheta"],
  electric: ["elektrisch", "electric"],
  romanian: ["rumanisch", "romanesc", "romania"],
  music: ["musik", "muzica"],
};

export interface SearchableProfile {
  id: string;
  name: string;
  category?: string;
  traits?: readonly string[];
}

export function searchHaystack(p: SearchableProfile): string {
  const parts = [p.name, p.category ?? "", ...(p.traits ?? [])];
  parts.push(...(CATEGORY_LABELS[p.category ?? ""] ?? []));
  const lower = normalizeSearch(p.name);
  for (const [word, labels] of Object.entries(WORD_LABELS)) {
    if (lower.includes(word)) parts.push(...labels);
  }
  if (isMusicPackageProfileId(p.id)) parts.push("music", "musik", "muzica", "drive the music");
  return normalizeSearch(parts.join(" "));
}

/** Every query word must appear somewhere in the profile's labels. */
export function matchesSoundQuery(p: SearchableProfile, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const hay = searchHaystack(p);
  return q.split(" ").every((w) => hay.includes(w));
}

export interface MenuGroupLike<T> {
  category: string;
  profiles: T[];
  [k: string]: unknown;
}

/** Filter grouped profiles by query; empty groups are dropped. */
export function filterMenuGroups<T extends SearchableProfile, G extends MenuGroupLike<T>>(
  groups: readonly G[],
  query: string,
): G[] {
  if (!normalizeSearch(query)) return [...groups];
  return groups
    .map((g) => ({ ...g, profiles: g.profiles.filter((p) => matchesSoundQuery(p, query)) }))
    .filter((g) => g.profiles.length > 0);
}

/**
 * Special group: the named engine sounds, then every Drive the Music genre (a genre with
 * its own profile uses that profile, others are `genre:<id>` items played through
 * Motion Orchestra), then the remaining music profiles. Excluded ids stay in `rest`.
 */
export function driveSpecialPinned<T extends { id: string; name: string }>(
  profiles: readonly T[],
): { pinned: T[]; rest: T[] } {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const companions = DRIVE_SPECIAL_COMPANION_IDS.map((id) => byId.get(id)).filter((p): p is T =>
    Boolean(p),
  );
  const host = byId.get(DRIVE_SPECIAL_GENRE_HOST_ID);
  const genres: T[] = [];
  for (const g of DRIVE_SPECIAL_GENRE_ITEMS) {
    const own = g.signature ? byId.get(g.profileId) : undefined;
    if (own && own.name === g.name) genres.push(own);
    else if (host) genres.push({ ...host, id: g.id, name: g.name });
  }
  const used = new Set([...companions, ...genres].map((p) => p.id));
  const music = profiles.filter(
    (p) =>
      isMusicPackageProfileId(p.id) &&
      !used.has(p.id) &&
      !DRIVE_SPECIAL_EXCLUDED_IDS.includes(p.id),
  );
  const pinned = [...companions, ...genres, ...music];
  const ids = new Set(pinned.map((p) => p.id));
  return { pinned, rest: profiles.filter((p) => !ids.has(p.id)) };
}

/** Real profile behind a menu item id (`genre:<id>` → its playing profile). */
export function profileIdForMenuItem(id: string): string {
  return driveSpecialGenreItem(id)?.profileId ?? id;
}

/** Which package unlocks a locked profile, and where to buy it. */
export function packageForProfile(profileId: string): "drive_music" | "drive_plus" {
  return isMusicPackageProfileId(profileIdForMenuItem(profileId)) ? "drive_music" : "drive_plus";
}
export function pricingHrefForProfile(profileId: string): string {
  return packageForProfile(profileId) === "drive_music"
    ? "/pricing#drive-music"
    : "/pricing#drive-plus";
}
