import type { SoundProfile } from "@/lib/sound/profiles";

/**
 * Technical families for improved synthesis / motion routing.
 * Profiles do not share one sound model.
 *
 * Authoritative for `motionFromDrive` and related routing. Package INDEX
 * "Technical family" labels may differ for a few IDs — see
 * docs/FAMILY_CLASSIFICATION_MISMATCHES.md. Do not realign those without a
 * dedicated sound-improvement pass (not metadata-only).
 */
export type ProfileFamily = "physical" | "designed" | "environmental" | "musical";

const FAMILY_BY_ID: Record<string, ProfileFamily> = {
  "gt-v8": "physical",
  "racing-v10": "physical",
  "f1-v10": "physical",
  traby: "physical",
  "ge-squared": "physical",
  "police-patrol": "physical",
  "race-car": "physical",
  "rally-car": "physical",
  "speed-boat": "physical",
  "cruise-ship": "physical",
  "turbine-jet": "physical",
  helicopter: "physical",
  "private-jet": "physical",
  "steam-train": "physical",
  "wiesn-tractor": "physical",
  "flat-six-sport": "physical",
  "american-muscle-v8": "physical",
  "turbo-inline-6": "physical",
  "motorcycle-superbike": "physical",
  "big-twin": "physical",
  "jet-ski": "physical",
  snowmobile: "physical",
  tank: "physical",
  "construction-monster": "physical",
  "maglev-train": "physical",
  "high-speed-train": "physical",
  submarine: "physical",

  "cyber-pulse": "designed",
  "space-ship": "designed",
  ufo: "designed",
  "electric-hypercar": "designed",
  "formula-electric": "designed",
  // Package INDEX labels neon-drive musical and dragon/thunder-beast environmental.
  // Runtime stays designed — changing these alters motion envelopes (not metadata-only).
  "neon-drive": "designed",
  dragon: "designed",
  "thunder-beast": "designed",

  "wild-west-carriage": "environmental",
  "romanian-85-carriage": "environmental",
  "open-wind": "environmental",
  "storm-glider": "environmental",
  "santa-sleigh": "environmental",
  "laughing-machine": "environmental",
  "farting-car": "environmental",
  "kazoo-kart": "environmental",
  "horse-gallop": "environmental",
  "zen-drive": "environmental",
  "rain-drive": "environmental",
  "ocean-drive": "environmental",

  "retro-arcade": "musical",
  "synthwave-drive": "musical",
  "deep-bass-pulse": "musical",
  heartbeat: "musical",
  "rocket-car": "designed",
  "time-machine": "designed",
  "symphony-cinematic-rock": "musical",
  "symphony-motion-orchestra": "musical",
  "symphony-neon-run": "musical",
  "symphony-latino-fiesta": "musical",
  "world-space-drive": "designed",
  "world-cyber-city": "designed",
  "world-storm-run": "environmental",
  "fusion-road-anthem": "musical",
  "fusion-mechanical-symphony": "musical",
  "fusion-midnight-boost": "musical",
  "fusion-future-pulse": "musical",
};

export function familyForProfile(profile: SoundProfile | string): ProfileFamily {
  const id = typeof profile === "string" ? profile : profile.id;
  return FAMILY_BY_ID[id] ?? "physical";
}

export function isEnvironmental(profile: SoundProfile | string) {
  return familyForProfile(profile) === "environmental";
}

export function isDesigned(profile: SoundProfile | string) {
  return familyForProfile(profile) === "designed";
}

export function isMusical(profile: SoundProfile | string) {
  return familyForProfile(profile) === "musical";
}
