/**
 * Drive / hero stills keyed by sound profile id.
 * Assets live at `/hero/sound-profiles/{profileId}.png`, synced from
 * `Images cars_elcamoso/Cars No Branding` via `scripts/sync-profile-hero-images.py`.
 */
const PROFILE_IDS_WITH_HERO = [
  "gt-v8",
  "racing-v10",
  // Reuses the unbranded open-wheeler still (formula-electric) until a dedicated F1 V10 shot exists.
  "f1-v10",
  "cyber-pulse",
  "race-car",
  "rally-car",
  "space-ship",
  "ufo",
  "speed-boat",
  "cruise-ship",
  "santa-sleigh",
  "romanian-85-carriage",
  "laughing-machine",
  "farting-car",
  "steam-train",
  "kazoo-kart",
  "turbine-jet",
  "helicopter",
  "private-jet",
  "wiesn-tractor",
  "open-wind",
  "storm-glider",
  "flat-six-sport",
  "american-muscle-v8",
  "turbo-inline-6",
  "electric-hypercar",
  "formula-electric",
  "neon-drive",
  "maglev-train",
  "high-speed-train",
  "submarine",
  "motorcycle-superbike",
  "big-twin",
  "snowmobile",
  "tank",
  "construction-monster",
  "horse-gallop",
  "dragon",
  "thunder-beast",
  "retro-arcade",
  "deep-bass-pulse",
  "zen-drive",
  "heartbeat",
  "rocket-car",
  "time-machine",
  "rain-drive",
  "ocean-drive",
  "wild-west-carriage",
  "dracula-carriage",
  "jet-ski",
  "synthwave-drive",
  "world-cyber-city",
  "world-space-drive",
  "world-storm-run",
  "symphony-cinematic-rock",
  "symphony-motion-orchestra",
  "symphony-neon-run",
  "fusion-road-anthem",
  "fusion-mechanical-symphony",
  "fusion-midnight-boost",
  "symphony-latino-fiesta",
  "traby",
  "ge-squared",
  "police-patrol",
] as const;

const PROFILE_HERO_SET = new Set<string>(PROFILE_IDS_WITH_HERO);

const HERO_BASE = "/hero/sound-profiles";

/** Resolve a still for a sound profile, or null when none is curated. */
export function profileHeroImageSrc(profileId: string | null | undefined): string | null {
  if (!profileId || !PROFILE_HERO_SET.has(profileId)) return null;
  return `${HERO_BASE}/${profileId}.png`;
}

/** Accessible / SEO-friendly alt for a curated hero still. */
export function profileHeroImageAlt(profileId: string): string {
  const label = profileId
    .replace(/^(world|symphony|fusion)-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `ELCAMOSO ${label} sound experience - turn motion into sound`;
}

/** Curated stills for the landing hero slideshow (subset, profile-id paths). */
export const HERO_SOUND_SLIDESHOW_IDS = [
  "rocket-car",
  "american-muscle-v8",
  "dragon",
  "time-machine",
  "gt-v8",
  "flat-six-sport",
  "romanian-85-carriage",
  "cyber-pulse",
  "horse-gallop",
  "racing-v10",
  "tank",
  "world-cyber-city",
  "submarine",
  "thunder-beast",
  "ufo",
  "zen-drive",
  "turbine-jet",
  "space-ship",
  "steam-train",
  "motorcycle-superbike",
  "maglev-train",
  "heartbeat",
  "open-wind",
  "santa-sleigh",
  "world-space-drive",
  "kazoo-kart",
  "farting-car",
  "big-twin",
] as const;

/** Music genres with a curated car still at `/hero/genres/{genre}.png`. */
export const GENRE_IDS_WITH_HERO = [
  "classic",
  "house",
  "rock",
  "pop",
  "metal",
  "hiphop",
  "country",
  "waltz",
  "latino",
  "gothic",
] as const;

const GENRE_HERO_SET = new Set<string>(GENRE_IDS_WITH_HERO);

/** Resolve the car still for a music genre, or null when none is curated. */
export function genreHeroImageSrc(genre: string | null | undefined): string | null {
  if (!genre || !GENRE_HERO_SET.has(genre)) return null;
  return `/hero/genres/${genre}.png`;
}
