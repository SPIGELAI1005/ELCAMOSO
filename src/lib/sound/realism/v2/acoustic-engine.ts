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
  // Design: strong idle lope (20-30% amplitude jitter) with visible pulse irregularity.
  // Spec §NEW-E: American Muscle V8 needs its idle lope to be audible and characterful.
  idleIrregularity: 0.55,
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
  supportRatios: [1, 2, 2.5, 3, 4],
  supportWeights: [0.88, 0.66, 0.14, 0.3, 0.11],
  forcedInduction: false,
  bodyBrightness: 0.36,
  redlineRpm: 6000,
};

const FLAT_SIX: AcousticEngineConfig = {
  cylinders: 6,
  stroke: "four-stroke",
  architecture: "flat-six",
  banks: "flat",
  architectureCode: 2,
  idleIrregularity: 0.1,
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
};

const TURBO_I6: AcousticEngineConfig = {
  cylinders: 6,
  stroke: "four-stroke",
  architecture: "inline-6",
  banks: "inline",
  architectureCode: 0,
  // Spec §NEW-E: Turbo I6 was near-silent at idle and cruise - raise exhaustPulse and
  // idle character. Even-firing I6 is smooth, but still needs audible presence.
  idleIrregularity: 0.14,
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
};

const V10: AcousticEngineConfig = {
  cylinders: 10,
  stroke: "four-stroke",
  architecture: "v10-even",
  banks: "v90",
  architectureCode: 0,
  idleIrregularity: 0.07,
  exhaustPulse: 0.64,
  intakePresence: 0.82,
  mechanicalIntensity: 0.58,
  combustionSharpness: 0.7,
  highLoadEnrichment: 0.86,
  loadContrast: 0.78,
  upperRpmEnergy: 0.96,
  intakeLoadResponse: 0.88,
  overrunCharacter: 0.38,
  exhaustFormantsHz: [130, 260, 560, 1100, 1600],
  intakeFormantsHz: [760, 1640, 3100],
  bodyResonanceHz: [140, 320, 780],
  supportRatios: [1, 2, 3, 4, 5, 6, 7.5, 9],
  supportWeights: [0.52, 0.38, 0.36, 0.28, 0.2, 0.14, 0.08, 0.04],
  forcedInduction: false,
  bodyBrightness: 0.64,
  redlineRpm: 8500,
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
  idleIrregularity: 0.06,
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
};

const RALLY_TURBO_3: AcousticEngineConfig = {
  cylinders: 3,
  stroke: "four-stroke",
  architecture: "inline-3",
  banks: "inline",
  // Unresolved: lope shortcut until explicit 3-cylinder topology (see RALLY_TURBO_3_LOPE_SHORTCUT).
  architectureCode: RALLY_TURBO_3_LOPE_SHORTCUT.architectureCode,
  idleIrregularity: 0.2,
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
};

const INLINE_4: AcousticEngineConfig = {
  cylinders: 4,
  stroke: "four-stroke",
  architecture: "inline-4",
  banks: "inline",
  architectureCode: 0,
  idleIrregularity: 0.14,
  exhaustPulse: 0.55,
  intakePresence: 0.7,
  mechanicalIntensity: 0.6,
  combustionSharpness: 0.72,
  highLoadEnrichment: 0.8,
  loadContrast: 0.78,
  upperRpmEnergy: 0.88,
  intakeLoadResponse: 0.86,
  overrunCharacter: 0.45,
  exhaustFormantsHz: [160, 340, 720, 1400],
  intakeFormantsHz: [900, 1900, 3200],
  bodyResonanceHz: [180, 420, 900],
  supportRatios: [1, 2, 3, 4, 5],
  supportWeights: [0.65, 0.4, 0.3, 0.18, 0.1],
  forcedInduction: false,
  bodyBrightness: 0.7,
  redlineRpm: 14000,
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
};

/** Sound profile id → acoustic config for Realism V2 combustion. */
export const ACOUSTIC_ENGINE_BY_PROFILE: Record<string, AcousticEngineConfig> = {
  "gt-v8": GT_V8,
  "american-muscle-v8": AMERICAN_V8,
  "flat-six-sport": FLAT_SIX,
  "turbo-inline-6": TURBO_I6,
  "racing-v10": V10,
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
