/**
 * Versioned calibration-trace schema for road-test replay.
 * No latitude/longitude — powertrain + motion only.
 */

export const CALIBRATION_TRACE_KIND = "elcamoso.calibration.trace" as const;
export const CALIBRATION_TRACE_VERSION = 1 as const;

/** One sample — enough to reproduce drivetrain + audio state without GPS route. */
export interface CalibrationTraceSample {
  /** Milliseconds from trace start. */
  tMs: number;
  speedKmh: number;
  /** Raw / channel speed when known (GPS or telemetry). */
  rawSpeedKmh: number | null;
  /** Fused / display speed used for UI. */
  fusedSpeedKmh: number;
  /** Lightly filtered mechanical speed when available. */
  mechanicalSpeedKmh: number | null;
  /** Heavily filtered shift-decision speed when available. */
  shiftDecisionSpeedKmh: number | null;
  accelerationMs2: number;
  accelerationFilteredMs2: number;
  jerk: number;
  driverDemand: number;
  engineLoad: number;
  /** Regen or braking proxy 0..1. */
  braking: number;
  motionSource: string;
  motionConfidence: number;
  fallbackTier: string;
  transitioning: boolean;
  gear: number;
  targetGear: number;
  queuedTargetGear: number;
  rpm: number;
  mechanicalRpm: number;
  shifting: boolean;
  shiftPhase: string;
  shiftProgress: number;
  shiftDirection: "up" | "down" | null;
  lastShiftReason: string;
  overrun: boolean;
  powertrainBackend: "legacy" | "dynamic" | "unknown";
}

export interface CalibrationMarker {
  id: string;
  tMs: number;
  /** Empty while driving; filled after stop. */
  label: string;
  note: string;
}

export interface CalibrationTraceMeta {
  profileId: string;
  personalityId: string | null;
  realismEngine: "current" | "v2" | "unknown";
  dynamicDrive: boolean;
  synthesisMode: string;
  label: string;
  /** Wall-clock ISO start — not a geographic route. */
  recordedAt: string;
  /** Source: road | scenario | import */
  origin: "road" | "scenario" | "import";
  scenarioId?: string;
}

export interface CalibrationTrace {
  kind: typeof CALIBRATION_TRACE_KIND;
  version: typeof CALIBRATION_TRACE_VERSION;
  id: string;
  meta: CalibrationTraceMeta;
  samples: CalibrationTraceSample[];
  markers: CalibrationMarker[];
  durationMs: number;
}

export interface CalibrationSubjectiveNote {
  id: string;
  traceId: string;
  at: number;
  realismEngine: "current" | "v2";
  mechanicalVsElectronic: "mechanical" | "electronic" | null;
  shiftFeel: "natural" | "artificial" | null;
  loadResponse: "good" | "weak" | null;
  fatigue: "comfortable" | "fatiguing" | null;
  freeText: string;
}

export const PROBLEM_MARKER_LABELS = [
  "wrong upshift",
  "shift too late",
  "RPM jump",
  "sound too electronic",
  "too much hiss",
  "kickdown missed",
  "engine sound disconnected from speed",
  "other",
] as const;

export type ProblemMarkerLabel = (typeof PROBLEM_MARKER_LABELS)[number];

export function createEmptySample(tMs: number): CalibrationTraceSample {
  return {
    tMs,
    speedKmh: 0,
    rawSpeedKmh: null,
    fusedSpeedKmh: 0,
    mechanicalSpeedKmh: null,
    shiftDecisionSpeedKmh: null,
    accelerationMs2: 0,
    accelerationFilteredMs2: 0,
    jerk: 0,
    driverDemand: 0,
    engineLoad: 0,
    braking: 0,
    motionSource: "unknown",
    motionConfidence: 0,
    fallbackTier: "decay",
    transitioning: false,
    gear: 0,
    targetGear: 0,
    queuedTargetGear: 0,
    rpm: 0,
    mechanicalRpm: 0,
    shifting: false,
    shiftPhase: "idle",
    shiftProgress: 0,
    shiftDirection: null,
    lastShiftReason: "none",
    overrun: false,
    powertrainBackend: "unknown",
  };
}
