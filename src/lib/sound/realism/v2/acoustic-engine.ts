/**
 * Acoustic-engine archetypes for Realism V2 combustion synthesis.
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

export interface AcousticEngineConfig {
  cylinders: number;
  stroke: StrokeCycle;
  architecture: FiringOrderArchetype;
  banks: BankConfiguration;
  /** Idle irregularity 0..1 — only meaningful near idle. */
  idleIrregularity: number;
  /** Exhaust pulse weight 0..1. */
  exhaustPulse: number;
  /** Intake resonance weight 0..1. */
  intakePresence: number;
  /** Mechanical / valvetrain intensity 0..1. */
  mechanicalIntensity: number;
  /** Semi-stationary exhaust formant centers (Hz). */
  exhaustFormantsHz: number[];
  /** Semi-stationary intake formant centers (Hz). */
  intakeFormantsHz: number[];
  /** Supporting harmonic partial ratios (band-limited, not sawtooth-dominant). */
  supportRatios: number[];
  supportWeights: number[];
  /** Forced induction present. */
  forcedInduction: boolean;
  /** Overall body darkness (lower = darker). */
  bodyBrightness: number;
}

/** True four-stroke firing frequency: RPM/60 × cylinders/2. */
export function firingHzFromRpm(rpm: number, cylinders: number, stroke: StrokeCycle): number {
  const r = Math.max(0, rpm);
  const c = Math.max(1, cylinders);
  if (stroke === "two-stroke") return (r / 60) * c;
  return (r / 60) * (c / 2);
}

const GT_V8: AcousticEngineConfig = {
  cylinders: 8,
  stroke: "four-stroke",
  architecture: "cross-plane-v8",
  banks: "v90",
  idleIrregularity: 0.18,
  exhaustPulse: 0.72,
  intakePresence: 0.38,
  mechanicalIntensity: 0.28,
  exhaustFormantsHz: [85, 160, 320, 640],
  intakeFormantsHz: [420, 980, 1800],
  supportRatios: [1, 2, 3, 4, 5],
  supportWeights: [1, 0.55, 0.28, 0.14, 0.08],
  forcedInduction: false,
  bodyBrightness: 0.42,
};

const AMERICAN_V8: AcousticEngineConfig = {
  cylinders: 8,
  stroke: "four-stroke",
  architecture: "cross-plane-v8-lope",
  banks: "v90",
  idleIrregularity: 0.42,
  exhaustPulse: 0.88,
  intakePresence: 0.32,
  mechanicalIntensity: 0.22,
  exhaustFormantsHz: [72, 140, 280, 520],
  intakeFormantsHz: [380, 860, 1500],
  supportRatios: [1, 2, 2.5, 3, 4],
  supportWeights: [1, 0.62, 0.22, 0.3, 0.12],
  forcedInduction: false,
  bodyBrightness: 0.38,
};

const FLAT_SIX: AcousticEngineConfig = {
  cylinders: 6,
  stroke: "four-stroke",
  architecture: "flat-six",
  banks: "flat",
  idleIrregularity: 0.12,
  exhaustPulse: 0.58,
  intakePresence: 0.55,
  mechanicalIntensity: 0.48,
  exhaustFormantsHz: [110, 220, 480, 920],
  intakeFormantsHz: [560, 1200, 2400],
  supportRatios: [1, 2, 3, 4, 6],
  supportWeights: [1, 0.48, 0.32, 0.18, 0.1],
  forcedInduction: false,
  bodyBrightness: 0.55,
};

const TURBO_I6: AcousticEngineConfig = {
  cylinders: 6,
  stroke: "four-stroke",
  architecture: "inline-6",
  banks: "inline",
  idleIrregularity: 0.1,
  exhaustPulse: 0.5,
  intakePresence: 0.45,
  mechanicalIntensity: 0.35,
  exhaustFormantsHz: [95, 190, 400, 780],
  intakeFormantsHz: [500, 1100, 2100],
  supportRatios: [1, 2, 3, 4, 5],
  supportWeights: [1, 0.5, 0.3, 0.16, 0.09],
  forcedInduction: true,
  bodyBrightness: 0.48,
};

const V10: AcousticEngineConfig = {
  cylinders: 10,
  stroke: "four-stroke",
  architecture: "v10-even",
  banks: "v90",
  idleIrregularity: 0.08,
  exhaustPulse: 0.62,
  intakePresence: 0.78,
  mechanicalIntensity: 0.55,
  exhaustFormantsHz: [130, 260, 560, 1100],
  intakeFormantsHz: [700, 1500, 2800],
  supportRatios: [1, 2, 3, 4, 5, 6],
  supportWeights: [1, 0.45, 0.35, 0.22, 0.14, 0.08],
  forcedInduction: false,
  bodyBrightness: 0.62,
};

/** Sound profile id → acoustic config for Realism V2 combustion. */
export const ACOUSTIC_ENGINE_BY_PROFILE: Record<string, AcousticEngineConfig> = {
  "gt-v8": GT_V8,
  "american-muscle-v8": AMERICAN_V8,
  "flat-six-sport": FLAT_SIX,
  "turbo-inline-6": TURBO_I6,
  "racing-v10": V10,
  "race-car": { ...FLAT_SIX, intakePresence: 0.7, mechanicalIntensity: 0.62, bodyBrightness: 0.68 },
  "rally-car": { ...TURBO_I6, idleIrregularity: 0.16, exhaustPulse: 0.64, intakePresence: 0.6 },
};

/** Drivetrain personality id → acoustic config. */
export const ACOUSTIC_ENGINE_BY_PERSONALITY: Record<string, AcousticEngineConfig> = {
  "gt-v8": GT_V8,
  "american-v8": AMERICAN_V8,
  "flat-six-sport": FLAT_SIX,
  "turbo-inline-6": TURBO_I6,
};

export function acousticEngineForProfile(profileId: string): AcousticEngineConfig | null {
  return ACOUSTIC_ENGINE_BY_PROFILE[profileId] ?? null;
}

export function isCombustionRealismV2Profile(profileId: string): boolean {
  return profileId in ACOUSTIC_ENGINE_BY_PROFILE;
}
