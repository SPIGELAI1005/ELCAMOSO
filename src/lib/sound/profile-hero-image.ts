/**
 * Drive / hero stills keyed by sound profile id.
 * Assets live at `/hero/sound-profiles/{profileId}.png`, synced from
 * `Images cars_elcamoso` via `scripts/sync-profile-hero-images.py`.
 */
const PROFILE_IDS_WITH_HERO = [
  "gt-v8",
  "racing-v10",
  "cyber-pulse",
  "race-car",
  "rally-car",
  "space-ship",
  "ufo",
  "speed-boat",
  "cruise-ship",
  "santa-sleigh",
  "wild-west-carriage",
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
  "rain-drive",
  "ocean-drive",
  "heartbeat",
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
  "fusion-future-pulse",
] as const;

const PROFILE_HERO_SET = new Set<string>(PROFILE_IDS_WITH_HERO);

const HERO_BASE = "/hero/sound-profiles";

/** Resolve a still for a sound profile, or null when none is curated. */
export function profileHeroImageSrc(profileId: string | null | undefined): string | null {
  if (!profileId || !PROFILE_HERO_SET.has(profileId)) return null;
  return `${HERO_BASE}/${profileId}.png`;
}
