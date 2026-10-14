/**
 * Subjective loudness balance per profile (0.4..1.6).
 * Applied on top of master volume so no profile dominates the library.
 * Target: -16 ±2 LUFS integrated, true peak <= -1 dBTP.
 * Updated 2026-10: Non-engine profiles significantly boosted for audibility at idle.
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
  "open-wind": 1.26,
  "storm-glider": 0.96,
  "santa-sleigh": 1.0,
  "laughing-machine": 1.28,
  "farting-car": 1.22,
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
  "thunder-beast": 1.02,
  "retro-arcade": 1.18,
  "synthwave-drive": 1.16,
  "deep-bass-pulse": 1.08,
  "zen-drive": 1.88,
  "rain-drive": 0.45,
  "ocean-drive": 1.38,
  heartbeat: 1.02,
  "synthetic-ev": 1.02,
};

export function loudnessForProfile(id: string) {
  return PROFILE_LOUDNESS[id] ?? 1;
}

/**
 * Catalog loudness makeup (dB) for non-engine profiles, applied after the
 * user-volume ceiling (see SoundEngine.applyCatalogMakeup). Measured with the
 * offline drive harness at volume 0.7, environment "open", target -16 LUFS
 * integrated and <= -1 dBTP. Engines are intentionally absent (0 dB).
 *
 * Values are the net gain. Above MAKEUP_LIMITER_ENGAGE_DB the makeup limiter is
 * engaged; the Web Audio compressor then adds its own spec-defined makeup gain,
 * which the engine subtracts (see makeupStageSettings).
 */
export const PROFILE_MAKEUP_DB: Record<string, number> = {
  "cyber-pulse": 1.6,
  "space-ship": 0.7,
  ufo: -6.9,
  "speed-boat": 2.1,
  "cruise-ship": 8.8,
  "santa-sleigh": 11.2,
  "wild-west-carriage": 8.2,
  "romanian-85-carriage": 8.8,
  "laughing-machine": 13.0,
  "farting-car": 3.7,
  "steam-train": 10.9,
  "kazoo-kart": 2.4,
  "turbine-jet": 2.9,
  helicopter: 1.5,
  "private-jet": 12.2,
  "wiesn-tractor": 5.5,
  "storm-glider": 4.4,
  "electric-hypercar": 2.7,
  "formula-electric": 3.8,
  "neon-drive": -3.8,
  "maglev-train": 4.3,
  "high-speed-train": 6.2,
  submarine: 8.5,
  "jet-ski": 1.7,
  snowmobile: 2.4,
  tank: 2.0,
  "horse-gallop": 6.2,
  dragon: 5.6,
  "thunder-beast": 3.4,
  "retro-arcade": 2.9,
  "synthwave-drive": 11.0,
  "zen-drive": 3.5,
  "rain-drive": -2.3,
  heartbeat: 4.2,
  "symphony-cinematic-rock": 8.5,
  "symphony-motion-orchestra": 10.4,
  "symphony-neon-run": 9.0,
  "world-space-drive": 0.9,
  "world-cyber-city": 2.0,
  "world-storm-run": 4.1,
  "fusion-road-anthem": 3.6,
  "fusion-mechanical-symphony": 2.9,
  "fusion-midnight-boost": 3.9,
  "fusion-future-pulse": 5.7,
}

export function makeupDbForProfile(id: string): number {
  const db = PROFILE_MAKEUP_DB[id] ?? 0;
  return Math.min(18, Math.max(-12, db));
}

/** Positive makeup above this engages the peak limiter. */
export const MAKEUP_LIMITER_ENGAGE_DB = 3;
export const MAKEUP_LIMITER_THRESHOLD_DB = -5.5;
export const MAKEUP_LIMITER_RATIO = 20;

/**
 * Gain-node dB and limiter settings for a catalog makeup value.
 * DynamicsCompressorNode applies automatic makeup of 0.6 × (the gain reduction
 * at 0 dBFS) per the Web Audio spec; it is subtracted so `db` stays the net gain.
 */
export function makeupStageSettings(db: number): {
  gainDb: number;
  limiterEngaged: boolean;
  thresholdDb: number;
  ratio: number;
} {
  if (db <= MAKEUP_LIMITER_ENGAGE_DB) {
    return { gainDb: db, limiterEngaged: false, thresholdDb: 0, ratio: 1 };
  }
  const t = MAKEUP_LIMITER_THRESHOLD_DB;
  const autoMakeupDb = 0.6 * -(t - t / MAKEUP_LIMITER_RATIO);
  return {
    gainDb: db - autoMakeupDb,
    limiterEngaged: true,
    thresholdDb: t,
    ratio: MAKEUP_LIMITER_RATIO,
  };
}
