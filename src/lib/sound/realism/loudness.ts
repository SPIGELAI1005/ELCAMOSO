/**
 * Subjective loudness balance per profile (0.4..1.6).
 * Applied on top of master volume so no profile dominates the library.
 * Target: -16 ±2 LUFS integrated, true peak <= -1 dBTP.
 * Updated 2026-10: Non-engine profiles rebalanced after level/bass fixes.
 */
export const PROFILE_LOUDNESS: Record<string, number> = {
  "gt-v8": 1.08,
  "racing-v10": 0.98,
  "race-car": 0.98,
  "rally-car": 0.96,
  "cyber-pulse": 1.05,
  "space-ship": 1.02,
  ufo: 1.15,
  "speed-boat": 0.92,
  "cruise-ship": 1.1,
  "turbine-jet": 0.88,
  "private-jet": 0.98,
  helicopter: 0.98,
  "wild-west-carriage": 1.04,
  "romanian-85-carriage": 1.05,
  "steam-train": 0.98,
  "wiesn-tractor": 1.02,
  "open-wind": 1.0,
  "storm-glider": 0.96,
  "santa-sleigh": 1.0,
  "laughing-machine": 0.95,
  "farting-car": 0.98,
  "kazoo-kart": 1.0,
  "flat-six-sport": 1.05,
  "american-muscle-v8": 1.04,
  "american-v8": 1.04,
  "turbo-inline-6": 1.04,
  "electric-hypercar": 0.98,
  "formula-electric": 0.96,
  "neon-drive": 1.08,
  "maglev-train": 1.02,
  "high-speed-train": 1.0,
  submarine: 1.08,
  "jet-ski": 0.96,
  "motorcycle-superbike": 0.98,
  "motorcycle-inline-4": 0.98,
  "big-twin": 1.02,
  "v-twin-cruiser": 1.02,
  snowmobile: 0.96,
  tank: 1.0,
  "construction-monster": 1.04,
  "horse-gallop": 1.0,
  dragon: 1.0,
  "thunder-beast": 0.98,
  "retro-arcade": 0.98,
  "synthwave-drive": 0.96,
  "deep-bass-pulse": 1.08,
  "zen-drive": 1.0,
  "rain-drive": 1.0,
  "ocean-drive": 1.0,
  heartbeat: 1.02,
  "synthetic-ev": 1.02,
};

export function loudnessForProfile(id: string) {
  return PROFILE_LOUDNESS[id] ?? 1;
}
