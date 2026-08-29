import type { SoundProfile } from "@/lib/sound/profiles";

/**
 * Technical families for improved synthesis.
 * Profiles do not share one sound model.
 */
export type ProfileFamily = "physical" | "designed" | "environmental" | "musical";

const FAMILY_BY_ID: Record<string, ProfileFamily> = {
  "gt-v8": "physical",
  "racing-v10": "physical",
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
