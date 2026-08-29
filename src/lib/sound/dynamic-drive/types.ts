/** Crossfade weights for Dynamic Drive RPM / event layers. */

export interface DynamicLayerWeights {
  idle: number;

  low: number;

  mid: number;

  high: number;

  redline: number;

  highLoad: number;

  upshiftTransient: number;

  downshiftTransient: number;

  revMatchTransient: number;

  overrunTransient: number;

  exhaustPopTransient: number;

  turboFlutterTransient: number;

  wastegateTransient: number;

  drivetrainThumpTransient: number;
}

export interface DynamicLayerDebugInfo {
  id: string;

  gain: number;

  /** Target fundamental frequency in Hz (not a single playbackRate hack). */

  fundamentalHz: number;

  /** Ratio vs profile base frequency — shown for tuning only. */

  playbackRate: number;
}

export const DYNAMIC_LAYER_IDS = [
  "dd-idle",

  "dd-low",

  "dd-mid",

  "dd-high",

  "dd-redline",

  "dd-high-load",

  "dd-upshift",

  "dd-downshift",

  "dd-rev-match",

  "dd-overrun",

  "dd-exhaust-pop",

  "dd-turbo-flutter",

  "dd-wastegate",

  "dd-drivetrain-thump",
] as const;

export type DynamicLayerId = (typeof DYNAMIC_LAYER_IDS)[number];

type SteadyBandKey = "idle" | "low" | "mid" | "high" | "redline";

/** RPM band centers (normalized 0..1) for crossfade windows. */

export const RPM_BAND_CENTERS: Record<SteadyBandKey, number> = {
  idle: 0.05,

  low: 0.22,

  mid: 0.48,

  high: 0.72,

  redline: 0.92,
};
