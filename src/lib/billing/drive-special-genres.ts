/**
 * 7 Days Drive Special: the Drive the Music genres listed inside the purple group
 * (George, 3 Nov 2026). Each genre plays through a music-package profile, so the
 * special's Drive the Music grant unlocks it for every signed-in account.
 */
import { GENRES, GENRE_IDS, type GenreId } from "@/lib/symphony/adaptive/genres";

/** Music sounds kept in their normal category, not in the special group. */
export const DRIVE_SPECIAL_EXCLUDED_IDS: readonly string[] = [
  "fusion-mechanical-symphony",
  "fusion-future-pulse",
];

/** Profile that plays any picked genre (no signature genre of its own). */
export const DRIVE_SPECIAL_GENRE_HOST_ID = "symphony-motion-orchestra";

/** Genres that already have their own music-package profile. */
const MUSIC_SIGNATURE_PROFILE: Partial<Record<GenreId, string>> = {
  anthem: "fusion-road-anthem",
  darkrave: "fusion-midnight-boost",
  latino: "symphony-latino-fiesta",
  pianoflow: "symphony-piano-flow",
  jazz: "symphony-jazz-cruise",
};

export const GENRE_ITEM_PREFIX = "genre:";

export interface DriveSpecialGenreItem {
  /** Menu item id (`genre:<id>`). */
  id: string;
  genreId: GenreId;
  name: string;
  /** Profile to drive with; access is checked on this id. */
  profileId: string;
  /** True when the profile plays this genre by itself (no genre choice needed). */
  signature: boolean;
}

export const DRIVE_SPECIAL_GENRE_ITEMS: readonly DriveSpecialGenreItem[] = GENRE_IDS.map(
  (genreId) => {
    const own = MUSIC_SIGNATURE_PROFILE[genreId];
    return {
      id: `${GENRE_ITEM_PREFIX}${genreId}`,
      genreId,
      name: GENRES[genreId].name,
      profileId: own ?? DRIVE_SPECIAL_GENRE_HOST_ID,
      signature: Boolean(own),
    };
  },
);

export function driveSpecialGenreItem(id: string): DriveSpecialGenreItem | undefined {
  return DRIVE_SPECIAL_GENRE_ITEMS.find((g) => g.id === id);
}
