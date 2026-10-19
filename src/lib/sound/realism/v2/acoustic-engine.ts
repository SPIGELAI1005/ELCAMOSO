/**
 * Acoustic-engine archetypes for Realism V2.1 combustion synthesis.
 * Generic ELCAMOSO characters - not OEM recreations.
 */

import { applyAcousticCatalogTuning } from "@/lib/sound/realism/catalog-tuning/apply";
import {
  RALLY_TURBO_3_LOPE_SHORTCUT,
  type ArchitectureCodeV1,
  type FiringOrderArchetype,
} from "@/lib/sound/realism/v2/architecture-contract";

export type StrokeCycle = "four-stroke" | "two-stroke";

export type { FiringOrderArchetype };

export type BankConfiguration = "inline" | "v90" | "v60" | "flat" | "single";

/**
 * Worklet architecture code (contract v1).
 * Keep in sync with `architecture-contract.ts` and `combustion-processor.js`.
 * 0 even · 1 lope · 2 flat-six · 3 cross-plane · 4 v-twin · 5 single · 6 flat-plane-v8
 */
export type ArchitectureCode = ArchitectureCodeV1;

export interface AcousticEngineConfig {
  cylinders: number;
  stroke: StrokeCycle;
  architecture: FiringOrderArchetype;
  banks: BankConfiguration;
  /** Maps to worklet `architecture` parameter. */
  architectureCode: ArchitectureCode;
  /** Idle irregularity 0..1 - only meaningful near idle. */
  idleIrregularity: number;
  /** Exhaust pulse weight 0..1. */
  exhaustPulse: number;
  /** Intake resonance weight 0..1. */
  intakePresence: number;
  /** Mechanical / valvetrain intensity 0..1. */
  mechanicalIntensity: number;
  /** Combustion impulse sharpness 0..1 (worklet). */
  combustionSharpness: number;
  /** Extra high-load spectral enrichment 0..1. */
  highLoadEnrichment: number;
  /** Exhaust/intake contrast between light cruise and loaded operation 0..1. */
  loadContrast: number;
  /** Upper-order energy that arrives with RPM, independently from master gain 0..1. */
  upperRpmEnergy: number;
  /** How strongly load opens the intake path 0..1. */
  intakeLoadResponse: number;
  /** Overrun bed / pop tendency 0..1 (still state-gated). */
  overrunCharacter: number;
  /** Semi-stationary exhaust formant centers (Hz). */
  exhaustFormantsHz: number[];
  /** Semi-stationary intake formant centers (Hz). */
  intakeFormantsHz: number[];
  /** Semi-stationary engine/body resonances (Hz) - do not pitch with RPM. */
  bodyResonanceHz: number[];
  /**
   * Optional crank-order band schema (cycles per crank revolution) + weights 0..1.
   * Live V2 resonators use these only when `VITE_COMBUSTION_PROFILE_ORDER_BANDS` is on;
   * otherwise HybridCombustionSynth keeps the legacy ½/1/2 × firing-order bands.
   * Also copied into profile-spec recipe metadata (not live audio by itself).
   */
  supportRatios: number[];
  supportWeights: number[];
  /** Forced induction present. */
  forcedInduction: boolean;
  /** Overall body darkness (lower = darker). */
  bodyBrightness: number;
  /** Soft redline reference for rpmNorm (personality redline). */
  redlineRpm: number;
  /**
   * Per-engine output trim in dB. Applied as a final linear gain multiplier.
   * Root-cause §3: Normalizes loudness across engines so all hit ~-12.7 LUFS.
   */
  outputTrimDb: number;
  /**
   * Extra cruise-to-pull level contrast in dB, applied as a throttle-tracking gain on
   * every output path ahead of the peak protect. Full throttle is unity, so peaks are
   * unchanged and only part-throttle drops. Optional; 0 when unset.
   */
  throttleGapDb?: number;
  /** Optional synth-level lift-off / downshift exhaust pops (probability per event, level). */
  liftPops?: { probability: number; level: number };
  /** Bike quickshifter + auto-blipper (sound only): upshift cut/crack, downshift rev blip. */
  quickshifter?: {
    cutGain: number;
    cutTiltDb: number;
    crackProbability: number;
    crackLevel: number;
    blipLevel: number;
    blipRpmFrac: number;
  };
  /**
   * Optional load-driven exhaust growl: mid-band excitation driven into a soft
   * saturator. Off below moderate load (it reads as rushing noise at cruise).
   */
  growl?: { centersHz: number[]; q: number; drive: number; level: number; lowpassHz: number };
  /**
   * Optional high-rpm voicing ahead of the peak protect: a low shelf cut and a presence
   * peak that open only above `startRpm` (full at `fullRpm`) and under load. Cruise and
   * light throttle are untouched.
   */
  highRpmVoicing?: {
    startRpm: number;
    fullRpm: number;
    lowShelfHz: number;
    lowShelfDb: number;
    presenceHz: number;
    presenceQ: number;
    presenceDb: number;
    /** Optional fixed upper-mid trim (dB) above `airHz` to keep the 2-4 kHz band in check. */
    airHz?: number;
    airDb?: number;
  };
  /** Optional ceiling for engine-order resonators (Hz, default 2400). */
  orderBandMaxHz?: number;
  /** Optional support-bus lowpass (Hz); default 1400 + bodyBrightness * 900. */
  supportLowpassHz?: number;
  /**
   * Optional alive idle: slow random rpm wander (±wanderRpm, smoothing wanderTauS) and an
   * occasional throttle blip (blipRpm range, every blipEveryS seconds) while parked. Only
   * active near standstill with no demand; absent → idle unchanged.
   */
  idleLife?: {
    wanderRpm: number;
    wanderTauS: number;
    blipRpm: [number, number];
    blipEveryS: [number, number];
    blipIntensity: number;
    /** Optional extra output trim (dB) while parked/idling only (fades out on the move). */
    idleGainDb?: number;
    /** Optional idle "breathing": ±dB level that follows the slow rpm hunt. */
    breathDb?: number;
    /** Optional faint turbo hiss level while parked (turbo profiles). */
    turboHiss?: number;
  };
  /**
   * Optional turbo whistle settle: full whistle for holdS once boost arrives, then it decays
   * (tauS) to `floor` × level even on sustained boost; ducks to zero on blow-off.
   */
  whistleSettle?: { holdS: number; tauS: number; floor: number };
  /**
   * Optional GPS-robust gentle vs hard acceleration (vehicle speed slope, not the weak GPS
   * throttle): output trim and spectral tilt per character. Absent → unchanged.
   */
  accelCharacter?: {
    gentleGainDb: number;
    hardGainDb: number;
    hardTiltDb: number;
    gentleTiltDb?: number;
  };
  /**
   * Optional Supra-style blow-off flutter (turbo only): chirp count, chirp rate (Hz), gate
   * depth 0..1, bandpass centre/Q and level scale. Absent → the default soft 3-dip blow-off.
   */
  turboFlutter?: { chirps: number; rateHz: number; depth: number; hz: number; q: number; level: number };
}

/** True four-stroke firing frequency: RPM × cylinders / 120. */
export function firingHzFromRpm(rpm: number, cylinders: number, stroke: StrokeCycle): number {
  const r = Math.max(0, rpm);
  const c = Math.max(1, cylinders);
  if (stroke === "two-stroke") return (r / 60) * c;
  return (r * c) / 120;
}

const GT_V8: AcousticEngineConfig = {
  cylinders: 8,
  stroke: "four-stroke",
  architecture: "cross-plane-v8",
  banks: "v90",
  architectureCode: 3,
  idleIrregularity: 0.1,
  exhaustPulse: 0.72,
  intakePresence: 0.44,
  mechanicalIntensity: 0.27,
  combustionSharpness: 0.43,
  highLoadEnrichment: 0.58,
  loadContrast: 0.52,
  upperRpmEnergy: 0.46,
  intakeLoadResponse: 0.5,
  overrunCharacter: 0.35,
  exhaustFormantsHz: [105, 205, 390, 740],
  intakeFormantsHz: [470, 1050, 1950],
  bodyResonanceHz: [112, 235, 510],
  supportRatios: [1, 2, 3, 4, 5, 6],
  supportWeights: [0.72, 0.46, 0.29, 0.18, 0.1, 0.05],
  forcedInduction: false,
  bodyBrightness: 0.42,
  redlineRpm: 6500,
  outputTrimDb: 18.2,
  throttleGapDb: 0.4,
};

/**
 * American Muscle V8 acoustic defaults (design choices, not a named vehicle).
 * Aligned with drivetrain personality idle lope; deep exhaust formants; NA.
 * Sample-assisted realism still requires approved steady-state loops - see
 * docs/audio/AMERICAN_MUSCLE_V8_PILOT_REVIEW.md.
 */
const AMERICAN_V8: AcousticEngineConfig = {
  cylinders: 8,
  stroke: "four-stroke",
  architecture: "cross-plane-v8-lope",
  banks: "v90",
  architectureCode: 1,
  // Design: strong idle lope (25-35% amplitude jitter) with visible pulse irregularity.
  // Spec §NEW-E: American Muscle V8 needs its idle lope to be audible and characterful.
  // Raised from 0.55 to 0.68 to restore lumpy idle (0.21 → 0.12 regression).
  idleIrregularity: 0.68,
  exhaustPulse: 0.98,
  intakePresence: 0.26,
  mechanicalIntensity: 0.2,
  // Design: slightly softer edge so body/exhaust dominate over metallic grit.
  combustionSharpness: 0.5,
  highLoadEnrichment: 0.66,
  loadContrast: 0.86,
  upperRpmEnergy: 0.3,
  intakeLoadResponse: 0.58,
  // Design: more lift-off character than GT (burble-adjacent, still NA).
  overrunCharacter: 0.55,
  exhaustFormantsHz: [78, 156, 312, 580],
  intakeFormantsHz: [360, 820, 1380],
  bodyResonanceHz: [86, 172, 390],
  // Cross-plane half-orders (2, 6) define the V8 burble character.
  // Crank order 2 = engine half-order (burble), order 6 = 3× half-order rumble.
  // Order 4 is the firing order - raised from 0.15 to 0.48 to lift firing share to ≥0.55
  // while keeping order-2 above 0.15 for the burble character.
  supportRatios: [1, 2, 2.5, 3, 4, 6],
  supportWeights: [0.88, 0.82, 0.14, 0.3, 0.48, 0.38],
  forcedInduction: false,
  bodyBrightness: 0.36,
  redlineRpm: 6000,
  outputTrimDb: 16.0,
  throttleGapDb: 2.0,
  // Synth-level lift-off pops (GPS-friendly trigger; see HybridCombustionSynth).
  liftPops: { probability: 0.85, level: 0.35 },
};

const FLAT_SIX: AcousticEngineConfig = {
  cylinders: 6,
  stroke: "four-stroke",
  architecture: "flat-six",
  banks: "flat",
  architectureCode: 2,
  idleIrregularity: 0.28,
  exhaustPulse: 0.56,
  intakePresence: 0.82,
  mechanicalIntensity: 0.7,
  combustionSharpness: 0.68,
  highLoadEnrichment: 0.72,
  loadContrast: 0.72,
  upperRpmEnergy: 0.84,
  intakeLoadResponse: 0.94,
  overrunCharacter: 0.28,
  exhaustFormantsHz: [125, 255, 540, 1080],
  intakeFormantsHz: [690, 1450, 2850],
  bodyResonanceHz: [145, 315, 690],
  supportRatios: [1, 2, 3, 4, 6, 7.5],
  supportWeights: [0.62, 0.42, 0.34, 0.24, 0.14, 0.07],
  forcedInduction: false,
  bodyBrightness: 0.58,
  redlineRpm: 9000,
  outputTrimDb: 18.8,
  throttleGapDb: 1.2,
  // Flat-six: smooth but alive - frequent soft blips, gentle breathing.
  idleLife: { wanderRpm: 65, wanderTauS: 0.45, blipRpm: [350, 900], blipEveryS: [3.5, 8], blipIntensity: 0.15, breathDb: 1.2 },
  // GPS-robust gentle vs hard: gentle pulls stay smooth and a touch darker, hard pulls open up.
  accelCharacter: { gentleGainDb: -1, hardGainDb: 2, hardTiltDb: 3, gentleTiltDb: -1.5 },
  growl: { centersHz: [270, 540], q: 0.9, drive: 0.75, level: 0.03, lowpassHz: 3000 },
  liftPops: { probability: 0.6, level: 0.25 },
};

const TURBO_I6: AcousticEngineConfig = {
  cylinders: 6,
  stroke: "four-stroke",
  architecture: "inline-6",
  banks: "inline",
  architectureCode: 0,
  // Spec §NEW-E: Turbo I6 was near-silent at idle and cruise - raise exhaustPulse and
  // idle character. Even-firing I6 is smooth, but still needs audible presence.
  idleIrregularity: 0.25,
  exhaustPulse: 0.68,
  intakePresence: 0.52,
  mechanicalIntensity: 0.4,
  combustionSharpness: 0.52,
  highLoadEnrichment: 0.7,
  loadContrast: 0.58,
  upperRpmEnergy: 0.62,
  intakeLoadResponse: 0.72,
  overrunCharacter: 0.35,
  exhaustFormantsHz: [108, 215, 430, 820],
  intakeFormantsHz: [540, 1160, 2200],
  bodyResonanceHz: [125, 275, 570],
  supportRatios: [1, 2, 3, 4, 5],
  supportWeights: [0.8, 0.45, 0.28, 0.14, 0.08],
  forcedInduction: true,
  bodyBrightness: 0.52,
  redlineRpm: 7000,
  outputTrimDb: 18.7,
  throttleGapDb: 1.8,
  // I6: silky - smaller lope, but the same blip rhythm as the rally car.
  idleLife: { wanderRpm: 55, wanderTauS: 0.5, blipRpm: [300, 750], blipEveryS: [4, 8], blipIntensity: 0.14, breathDb: 1, turboHiss: 0.006 },
  // GPS-robust gentle vs hard: gentle pulls stay smooth and a touch darker, hard pulls open up.
  accelCharacter: { gentleGainDb: -1, hardGainDb: 2.5, hardTiltDb: 2.5, gentleTiltDb: -1.5 },
  // Supra-style: spool whoosh + "stu-tu-tu" compressor/wastegate flutter on lift-off.
  turboFlutter: { chirps: 7, rateHz: 22, depth: 0.85, hz: 1700, q: 2.2, level: 1.1 },
  liftPops: { probability: 0.45, level: 0.22 },
  // Whistle swells on boost, then settles under the engine within ~1.5 s; drops on blow-off.
  whistleSettle: { holdS: 0.5, tauS: 0.6, floor: 0.2 },
};

const V10: AcousticEngineConfig = {
  cylinders: 10,
  stroke: "four-stroke",
  architecture: "v10-even",
  banks: "v90",
  architectureCode: 0,
  idleIrregularity: 0.38,
  exhaustPulse: 0.64,
  intakePresence: 0.82,
  mechanicalIntensity: 0.58,
  combustionSharpness: 0.7,
  highLoadEnrichment: 0.86,
  loadContrast: 0.78,
  upperRpmEnergy: 0.96,
  intakeLoadResponse: 0.88,
  overrunCharacter: 0.38,
  // Formants follow the reference road-V10 spectral envelope (peaks ~670/1100/1800/2300 Hz).
  exhaustFormantsHz: [200, 600, 1250, 1800, 2400],
  intakeFormantsHz: [1100, 2300, 3500],
  bodyResonanceHz: [140, 320, 780],
  // V10 orders: firing order 5 plus the bank half-orders and the 7.5-20 plateau.
  supportRatios: [5, 7.5, 12.5, 15, 17.5, 20],
  supportWeights: [1, 0.45, 0.7, 0.3, 0.5, 0.4],
  forcedInduction: false,
  bodyBrightness: 0.64,
  redlineRpm: 9000,
  // -1.9 dB vs before: the added half-orders and presence raised loudness ~1.9 LU.
  outputTrimDb: 16.8,
  highRpmVoicing: {
    startRpm: 4000,
    fullRpm: 8500,
    lowShelfHz: 260,
    lowShelfDb: -9,
    presenceHz: 1700,
    presenceQ: 0.8,
    presenceDb: 9,
    airHz: 3200,
    airDb: -3,
  },
  orderBandMaxHz: 5000,
  supportLowpassHz: 4200,
  // Alive idle: ~±70 rpm wander and an occasional small blip while parked.
  idleLife: { wanderRpm: 70, wanderTauS: 0.45, blipRpm: [400, 1000], blipEveryS: [3.5, 7.5], blipIntensity: 0.16, breathDb: 1.2 },
};

/**
 * F1 V10, "TV onboard" balance (reference: 2004-era onboard, 16-18.6k rpm): the 2.5 crank
 * order (one bank, intake/airbox howl) sits above the firing order, higher orders fall
 * off fast; little below 300 Hz, rolled off above ~3.5 kHz. Fully synthesised.
 */
const F1_V10: AcousticEngineConfig = {
  ...V10,
  idleIrregularity: 0.32,
  // Race-engine idle: hunts ±~100 rpm and gets the odd throttle blip, like a parked F1 car.
  idleLife: { wanderRpm: 150, wanderTauS: 0.35, blipRpm: [1000, 2500], blipEveryS: [3, 6.5], blipIntensity: 0.22, idleGainDb: 8, breathDb: 1.5 },
  exhaustPulse: 0.7,
  intakePresence: 0.95,
  mechanicalIntensity: 0.62,
  combustionSharpness: 0.86,
  highLoadEnrichment: 0.9,
  loadContrast: 0.8,
  upperRpmEnergy: 0.98,
  intakeLoadResponse: 0.95,
  overrunCharacter: 0.3,
  exhaustFormantsHz: [450, 740, 1470, 2160, 2900],
  intakeFormantsHz: [740, 1500, 2300],
  bodyResonanceHz: [180, 420, 900],
  supportRatios: [2.5, 5, 7.5, 10, 12.5],
  supportWeights: [0.85, 0.45, 0.22, 0.15, 0.08],
  bodyBrightness: 0.7,
  redlineRpm: 19000,
  outputTrimDb: 18.6,
  highRpmVoicing: {
    startRpm: 6000,
    fullRpm: 16000,
    lowShelfHz: 300,
    lowShelfDb: -10,
    presenceHz: 800,
    presenceQ: 0.9,
    presenceDb: 5,
    airHz: 2800,
    airDb: -10,
  },
  orderBandMaxHz: 4000,
  supportLowpassHz: 3000,
};

const FLAT_PLANE_V8_TRACK: AcousticEngineConfig = {
  cylinders: 8,
  stroke: "four-stroke",
  architecture: "flat-plane-v8",
  banks: "v90",
  // Contract v1: flat-plane-v8 is code 6. Code 5 is single only.
  // Spec §NEW-E: Race Car must sound distinct from GT V8 - flat-plane has even bank
  // alternation, sharper/brighter character, and higher-frequency exhaust resonance.
  architectureCode: 6,
  idleIrregularity: 0.34,
  // Higher exhaust pulse and sharper combustion than GT V8's 0.72/0.43
  exhaustPulse: 0.78,
  intakePresence: 0.82,
  mechanicalIntensity: 0.72,
  combustionSharpness: 0.82,
  highLoadEnrichment: 0.88,
  loadContrast: 0.84,
  upperRpmEnergy: 0.94,
  intakeLoadResponse: 0.9,
  overrunCharacter: 0.45,
  // Higher formant centers than GT V8 for the "scream" characteristic
  exhaustFormantsHz: [160, 320, 680, 1360, 2100],
  intakeFormantsHz: [920, 1850, 3400],
  bodyResonanceHz: [175, 380, 920],
  supportRatios: [1, 2, 3, 4, 6, 8],
  supportWeights: [0.65, 0.42, 0.36, 0.24, 0.14, 0.07],
  forcedInduction: false,
  // Brighter than GT V8's 0.42 for the flat-plane V8 scream
  bodyBrightness: 0.82,
  redlineRpm: 8600,
  outputTrimDb: 17.7,
  // Alive idle: slow rpm hunt and the odd blip while parked (no ticks, no crackle).
  // Flat-plane V8: sharper lope, bigger, more frequent blips.
  idleLife: { wanderRpm: 75, wanderTauS: 0.4, blipRpm: [450, 1200], blipEveryS: [3.5, 7], blipIntensity: 0.16, breathDb: 1.5 },
  // GPS-robust gentle vs hard: gentle pulls stay smooth and a touch darker, hard pulls open up.
  accelCharacter: { gentleGainDb: -1, hardGainDb: 2, hardTiltDb: 3, gentleTiltDb: -1.5 },
  // Performance exhaust: titanium-style rasp on hard pulls, burble/pops on lift-off at speed.
  growl: { centersHz: [320, 680], q: 0.9, drive: 0.8, level: 0.035, lowpassHz: 3200 },
  liftPops: { probability: 0.7, level: 0.3 },
};

const RALLY_TURBO_3: AcousticEngineConfig = {
  cylinders: 3,
  stroke: "four-stroke",
  architecture: "inline-3",
  banks: "inline",
  // Unresolved: lope shortcut until explicit 3-cylinder topology (see RALLY_TURBO_3_LOPE_SHORTCUT).
  architectureCode: RALLY_TURBO_3_LOPE_SHORTCUT.architectureCode,
  idleIrregularity: 0.28,
  exhaustPulse: 0.74,
  intakePresence: 0.58,
  mechanicalIntensity: 0.64,
  combustionSharpness: 0.68,
  highLoadEnrichment: 0.84,
  loadContrast: 0.86,
  upperRpmEnergy: 0.68,
  intakeLoadResponse: 0.78,
  overrunCharacter: 0.68,
  exhaustFormantsHz: [78, 165, 360, 760, 1260],
  intakeFormantsHz: [620, 1350, 2550],
  bodyResonanceHz: [92, 220, 540],
  supportRatios: [1, 1.5, 2, 3, 4.5],
  supportWeights: [0.9, 0.32, 0.45, 0.2, 0.1],
  forcedInduction: true,
  bodyBrightness: 0.58,
  redlineRpm: 6800,
  outputTrimDb: 19.2,
  throttleGapDb: 3.1,
  idleLife: { wanderRpm: 80, wanderTauS: 0.4, blipRpm: [400, 1000], blipEveryS: [5, 10], blipIntensity: 0.15 },
  // GPS-robust gentle vs hard: gentle pulls stay smooth and a touch darker, hard pulls open up.
  accelCharacter: { gentleGainDb: -1, hardGainDb: 2, hardTiltDb: 3, gentleTiltDb: -1.5 },
  turboFlutter: { chirps: 9, rateHz: 18, depth: 0.9, hz: 1500, q: 2, level: 1.2 },
  // Anti-lag style bangs on lift-off at speed.
  liftPops: { probability: 0.85, level: 0.4 },
  whistleSettle: { holdS: 0.4, tauS: 0.5, floor: 0.2 },
};

const INLINE_4: AcousticEngineConfig = {
  cylinders: 4,
  stroke: "four-stroke",
  architecture: "inline-4",
  banks: "inline",
  architectureCode: 0,
  idleIrregularity: 0.26,
  exhaustPulse: 0.6,
  intakePresence: 0.84,
  mechanicalIntensity: 0.6,
  combustionSharpness: 0.8,
  highLoadEnrichment: 0.86,
  loadContrast: 0.78,
  upperRpmEnergy: 0.96,
  intakeLoadResponse: 0.94,
  overrunCharacter: 0.45,
  // S1000RR-style: short Akrapovic-type system, bright 2nd/4th-order rasp.
  exhaustFormantsHz: [180, 380, 800, 1600],
  // Airbox / intake howl at high revs.
  intakeFormantsHz: [1050, 2200, 3600],
  bodyResonanceHz: [180, 420, 900],
  supportRatios: [1, 2, 3, 4, 5],
  supportWeights: [0.75, 0.55, 0.3, 0.24, 0.1],
  forcedInduction: false,
  bodyBrightness: 0.8,
  // Acoustic range for the S1000RR scream (gear logic keeps its own redline).
  redlineRpm: 14600,
  outputTrimDb: 21.2,
  throttleGapDb: 2.3,
  // High-rpm scream: thin the low end and lift the upper-mid howl as the revs climb.
  highRpmVoicing: { startRpm: 2500, fullRpm: 9000, lowShelfHz: 200, lowShelfDb: -7, presenceHz: 1900, presenceQ: 0.85, presenceDb: 8, airHz: 4500, airDb: -1 },
  // Alive idle: crisp four, quick light blips (rally-style hunt, no ticks / crackle).
  idleLife: { wanderRpm: 60, wanderTauS: 0.35, blipRpm: [700, 2000], blipEveryS: [3.5, 7], blipIntensity: 0.18, breathDb: 1.2 },
  accelCharacter: { gentleGainDb: -1, hardGainDb: 2.5, hardTiltDb: 3.5, gentleTiltDb: -1.5 },
  growl: { centersHz: [420, 900], q: 0.9, drive: 0.75, level: 0.04, lowpassHz: 4000 },
  liftPops: { probability: 0.6, level: 0.26 },
  quickshifter: { cutGain: 0.4, cutTiltDb: 9, crackProbability: 0.8, crackLevel: 0.32, blipLevel: 0.42, blipRpmFrac: 0.18 },
};

const V_TWIN: AcousticEngineConfig = {
  cylinders: 2,
  stroke: "four-stroke",
  architecture: "v-twin",
  banks: "v90",
  architectureCode: 4,
  idleIrregularity: 0.55,
  exhaustPulse: 0.92,
  intakePresence: 0.28,
  mechanicalIntensity: 0.25,
  combustionSharpness: 0.38,
  highLoadEnrichment: 0.4,
  loadContrast: 0.72,
  upperRpmEnergy: 0.2,
  intakeLoadResponse: 0.4,
  overrunCharacter: 0.5,
  exhaustFormantsHz: [55, 110, 220, 440],
  intakeFormantsHz: [280, 640, 1100],
  bodyResonanceHz: [60, 130, 300],
  supportRatios: [1, 1.5, 2, 3],
  supportWeights: [1, 0.35, 0.45, 0.2],
  forcedInduction: false,
  bodyBrightness: 0.32,
  redlineRpm: 5500,
  outputTrimDb: 18.0,
  throttleGapDb: 2.8,
};

/** Sound profile id → acoustic config for Realism V2 combustion. */
export const ACOUSTIC_ENGINE_BY_PROFILE: Record<string, AcousticEngineConfig> = {
  "gt-v8": GT_V8,
  "american-muscle-v8": AMERICAN_V8,
  "flat-six-sport": FLAT_SIX,
  "turbo-inline-6": TURBO_I6,
  "racing-v10": V10,
  "f1-v10": F1_V10,
  "race-car": FLAT_PLANE_V8_TRACK,
  "rally-car": RALLY_TURBO_3,
  "motorcycle-superbike": INLINE_4,
  "big-twin": V_TWIN,
};

/** Drivetrain personality id → acoustic config. */
export const ACOUSTIC_ENGINE_BY_PERSONALITY: Record<string, AcousticEngineConfig> = {
  "gt-v8": GT_V8,
  "american-v8": AMERICAN_V8,
  "flat-six-sport": FLAT_SIX,
  "high-rev-v10": V10,
  "f1-v10": F1_V10,
  "flat-plane-v8-track": FLAT_PLANE_V8_TRACK,
  "rally-turbo-3": RALLY_TURBO_3,
  "turbo-inline-6": TURBO_I6,
  "motorcycle-inline-4": INLINE_4,
  "v-twin-cruiser": V_TWIN,
};

/** Untuned archetype (Prompt 07 baselines / A-B). Prefer acousticEngineForProfile at runtime. */
export function acousticEngineBaseForProfile(profileId: string): AcousticEngineConfig | null {
  return ACOUSTIC_ENGINE_BY_PROFILE[profileId] ?? null;
}

/** Runtime acoustic config including Prompt 07 catalog overlays. */
export function acousticEngineForProfile(profileId: string): AcousticEngineConfig | null {
  const base = acousticEngineBaseForProfile(profileId);
  if (!base) return null;
  return applyAcousticCatalogTuning(profileId, base);
}

export function isCombustionRealismV2Profile(profileId: string): boolean {
  return profileId in ACOUSTIC_ENGINE_BY_PROFILE;
}
