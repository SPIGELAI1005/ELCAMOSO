/**
 * Fighter Jet (catalog "Turbine Jet", id turbine-jet) airfield frame, same structure as
 * Private Jet Oberpfaffenhofen (George, 24 Nov 2026: "more brutal, similar to the rocket car"):
 *
 * - Parked: the Turbine Jet's own turbofan idle (its ImprovedSynth strategy, old level),
 *   no car sound, plus snappier, harder pre-flight control-surface checks.
 * - Moving: the Rocket Car sound, unchanged (SOUND_ALIASES base "rocket-car", +1.5 dB):
 *   thrust roar, turbine whine rising with speed, crackle, ignition blast, cold-gas pssht,
 *   lift-off thunder and debris.
 * - Take-off: afterburner light + reheat roar and a high turbine whistle that climbs
 *   with speed, both gated by the shared take-off detection.
 */
import type { AirfieldConfig } from "./airfield";

/** Rocket Car runs louder than the old Turbine Jet makeup; see FIGHTER_JET_BED_TRIM. */
export const FIGHTER_JET_ENGINE_GAIN_DB = 1.5;

/**
 * Parked bed level vs the old Turbine Jet: old makeup +2.9 dB and loudness 0.88 (loudness.ts),
 * Rocket Car base 0 dB / 1.0, and the alias gain applies to the whole chain, so the bed
 * removes it again. +0.35 dB from the offline drive harness so the parked idle matches the
 * live Turbine Jet idle level (master-bus saturation/program compressor differ slightly).
 */
export const FIGHTER_JET_BED_TRIM = 10 ** ((2.9 - FIGHTER_JET_ENGINE_GAIN_DB + 0.35) / 20) * 0.88;

export const FIGHTER_JET_AIRFIELD: AirfieldConfig = {
  bedTrim: FIGHTER_JET_BED_TRIM,
  // Own random stream for the parked bed: Rocket Car draws exactly what it draws on its own.
  bedRandomSeed: 0x46a17bed,
  whistle: {
    armKmh: 30,
    endKmh: 220,
    launchAccel: 1.2,
    launchThrottle: 0.35,
    // Rocket Car is quiet above 4 kHz, so a lower level still stands ~20 dB out (Private Jet
    // over Ge-Squared: 8-16 dB); a 2.6-5.5 kHz scream instead of a shrill 8 kHz one.
    level: 0.05,
    range: { baseHz: 2600, spanHz: 2400 },
    speedHz: 800,
    // Rocket Car is gearless (rpm 0): spool follows speed × load instead.
    rpmFromSpeed: { idleRpm: 1800, fullRpm: 6200, fullKmh: 110 },
  },
  wingCheck: {
    firstS: 2,
    everyS: [7, 12],
    level: 0.2,
    flapsShare: 0.35,
    durScale: 0.55,
    pitchScale: 1.45,
    clunkScale: 1.3,
    lowpassHz: 3600,
  },
  wingSeed: 0x46a17e7,
  afterburner: true,
};
