/**
 * Acoustic-engine archetypes for Realism V2.1 combustion synthesis.
 * Generic ELCAMOSO characters — not OEM recreations.
 */

export type StrokeCycle = "four-stroke" | "two-stroke";

export type FiringOrderArchetype =
  | "cross-plane-v8"
  | "cross-plane-v8-lope"
  | "flat-six"
  | "inline-6"
  | "v10-even"
  | "inline-4"
  | "v-twin"
  | "single";

export type BankConfiguration = "inline" | "v90" | "v60" | "flat" | "single";

/** Worklet architecture code — keep in sync with combustion-processor.js */
export type ArchitectureCode = 0 | 1 | 2 | 3 | 4 | 5;

export interface AcousticEngineConfig {
  cylinders: number;
  stroke: StrokeCycle;
  architecture: FiringOrderArchetype;
  banks: BankConfiguration;
  /** Maps to worklet `architecture` parameter. */
  architectureCode: ArchitectureCode;
  /** Idle irregularity 0..1 — only meaningful near idle. */
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
  /** Overrun bed / pop tendency 0..1 (still state-gated). */
  overrunCharacter: number;
  /** Semi-stationary exhaust formant centers (Hz). */
  exhaustFormantsHz: number[];
  /** Semi-stationary intake formant centers (Hz). */
  intakeFormantsHz: number[];
  /** Semi-stationary engine/body resonances (Hz) — do not pitch with RPM. */
  bodyResonanceHz: number[];
  /** Supporting harmonic partial ratios (band-limited, not sawtooth-dominant). */
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
  idleIrregularity: 0.16,
  exhaustPulse: 0.74,
  intakePresence: 0.4,
  mechanicalIntensity: 0.3,
  combustionSharpness: 0.48,
  highLoadEnrichment: 0.55,
  overrunCharacter: 0.35,
  exhaustFormantsHz: [85, 160, 320, 640],
  intakeFormantsHz: [420, 980, 1800],
  bodyResonanceHz: [95, 210, 480],
  supportRatios: [1, 2, 3, 4, 5],
  supportWeights: [0.85, 0.42, 0.22, 0.12, 0.06],
  forcedInduction: false,
  bodyBrightness: 0.42,
  redlineRpm: 6500,
};

const AMERICAN_V8: AcousticEngineConfig = {
  cylinders: 8,
  stroke: "four-stroke",
  architecture: "cross-plane-v8-lope",
  banks: "v90",
  architectureCode: 1,
  idleIrregularity: 0.44,
  exhaustPulse: 0.9,
  intakePresence: 0.3,
  mechanicalIntensity: 0.22,
  combustionSharpness: 0.4,
  highLoadEnrichment: 0.48,
  overrunCharacter: 0.42,
  exhaustFormantsHz: [68, 130, 260, 500],
  intakeFormantsHz: [360, 820, 1400],
  bodyResonanceHz: [72, 155, 380],
  supportRatios: [1, 2, 2.5, 3, 4],
  supportWeights: [1, 0.55, 0.18, 0.26, 0.1],
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
  intakePresence: 0.62,
  mechanicalIntensity: 0.52,
  combustionSharpness: 0.58,
  highLoadEnrichment: 0.62,
  overrunCharacter: 0.28,
  exhaustFormantsHz: [110, 220, 480, 920],
  intakeFormantsHz: [560, 1200, 2400],
  bodyResonanceHz: [125, 280, 620],
  supportRatios: [1, 2, 3, 4, 6],
  supportWeights: [0.75, 0.4, 0.28, 0.16, 0.09],
  forcedInduction: false,
  bodyBrightness: 0.58,
  redlineRpm: 8000,
};

const TURBO_I6: AcousticEngineConfig = {
  cylinders: 6,
  stroke: "four-stroke",
  architecture: "inline-6",
  banks: "inline",
  architectureCode: 0,
  idleIrregularity: 0.09,
  exhaustPulse: 0.52,
  intakePresence: 0.48,
  mechanicalIntensity: 0.36,
  combustionSharpness: 0.5,
  highLoadEnrichment: 0.7,
  overrunCharacter: 0.32,
  exhaustFormantsHz: [95, 190, 400, 780],
  intakeFormantsHz: [500, 1100, 2100],
  bodyResonanceHz: [105, 240, 520],
  supportRatios: [1, 2, 3, 4, 5],
  supportWeights: [0.8, 0.45, 0.28, 0.14, 0.08],
  forcedInduction: true,
  bodyBrightness: 0.48,
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
  combustionSharpness: 0.66,
  highLoadEnrichment: 0.75,
  overrunCharacter: 0.38,
  exhaustFormantsHz: [130, 260, 560, 1100, 1600],
  intakeFormantsHz: [700, 1500, 2800],
  bodyResonanceHz: [140, 320, 780],
  supportRatios: [1, 2, 3, 4, 5, 6],
  supportWeights: [0.7, 0.38, 0.32, 0.2, 0.12, 0.07],
  forcedInduction: false,
  bodyBrightness: 0.64,
  redlineRpm: 9000,
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
  "race-car": {
    ...FLAT_SIX,
    intakePresence: 0.72,
    mechanicalIntensity: 0.64,
    bodyBrightness: 0.7,
    combustionSharpness: 0.65,
  },
  "rally-car": {
    ...TURBO_I6,
    idleIrregularity: 0.16,
    exhaustPulse: 0.64,
    intakePresence: 0.6,
    overrunCharacter: 0.4,
  },
  "motorcycle-superbike": INLINE_4,
  "big-twin": V_TWIN,
};

/** Drivetrain personality id → acoustic config. */
export const ACOUSTIC_ENGINE_BY_PERSONALITY: Record<string, AcousticEngineConfig> = {
  "gt-v8": GT_V8,
  "american-v8": AMERICAN_V8,
  "flat-six-sport": FLAT_SIX,
  "turbo-inline-6": TURBO_I6,
  "motorcycle-inline-4": INLINE_4,
  "v-twin-cruiser": V_TWIN,
};

export function acousticEngineForProfile(profileId: string): AcousticEngineConfig | null {
  return ACOUSTIC_ENGINE_BY_PROFILE[profileId] ?? null;
}

export function isCombustionRealismV2Profile(profileId: string): boolean {
  return profileId in ACOUSTIC_ENGINE_BY_PROFILE;
}
