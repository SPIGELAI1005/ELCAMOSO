/**
 * JourneyTraceV1 - privacy-safe motion capture schema.
 * Raw motion only. No lat/lon/route. Experience interpretation is applied later.
 */

export type DriveOutputMode = "live" | "capture" | "live-and-capture";

export type TraceSensorSource =
  "tesla-browser" | "phone" | "vehicle-telemetry" | "simulator" | "none";

export type TraceSemanticEventType =
  | "movement_start"
  | "strong_acceleration"
  | "cruise_start"
  | "cruise_end"
  | "lift"
  | "regen"
  | "stop"
  | "data_gap"
  | "capture_paused"
  | "capture_resumed";

/** Compact motion sample - personality-independent. */
export interface JourneyTraceSampleV1 {
  /** ms from journey start */
  t: number;
  /** km/h */
  speedKmh: number;
  /** m/s² signed longitudinal */
  acceleration: number;
  longitudinalAccel: number;
  /** approx ±1 */
  jerk: number;
  /** 0..1 */
  driverDemandEstimate: number;
  /** 0..1 */
  regenEstimate: number;
  /** 0..1 */
  movementConfidence: number;
  sourceQuality: number;
  primarySource: TraceSensorSource;
}

export interface JourneyTraceSemanticEventV1 {
  t: number;
  type: TraceSemanticEventType;
  /** Optional magnitude 0..1 */
  intensity?: number;
}

export interface JourneyTraceGapV1 {
  startT: number;
  endT: number;
  reason: "visibility" | "sensor_loss" | "browser_suspend" | "unknown";
}

export interface JourneyTraceSummaryV1 {
  sampleCount: number;
  durationMs: number;
  distanceM: number;
  meanSpeedKmh: number;
  maxSpeedKmh: number;
  movingShare: number;
  gapCount: number;
  gapMs: number;
  primarySource: TraceSensorSource;
  endedUnexpectedly: boolean;
  browserPaused: boolean;
}

export interface JourneyTraceChunkV1 {
  journeyId: string;
  chunkIndex: number;
  samples: JourneyTraceSampleV1[];
  events: JourneyTraceSemanticEventV1[];
  gaps: JourneyTraceGapV1[];
  writtenAt: number;
}

export interface JourneyTraceV1 {
  version: 1;
  journeyId: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  outputMode: DriveOutputMode;
  /** Profile selected at capture time - not baked into raw samples */
  captureProfileId: string | null;
  status: "recording" | "complete" | "incomplete";
  samples: JourneyTraceSampleV1[];
  semanticEvents: JourneyTraceSemanticEventV1[];
  gaps: JourneyTraceGapV1[];
  summary: JourneyTraceSummaryV1;
}

export interface JourneyInterpretationV1 {
  id: string;
  journeyId: string;
  experienceId: string;
  experienceKind: "engine" | "symphony" | "world" | "fusion";
  seed: number;
  createdAt: number;
  label?: string;
}

export const DRIVE_OUTPUT_MODE_COPY: Record<DriveOutputMode, { title: string; subtitle: string }> =
  {
    live: {
      title: "LIVE SOUND",
      subtitle: "Hear ELCAMOSO while you drive.",
    },
    capture: {
      title: "SILENT CAPTURE",
      subtitle: "Record the motion. Hear it afterwards.",
    },
    "live-and-capture": {
      title: "LIVE + CAPTURE",
      subtitle: "Hear it now and keep the journey.",
    },
  };

export function isDriveOutputMode(v: unknown): v is DriveOutputMode {
  return v === "live" || v === "capture" || v === "live-and-capture";
}

export function shouldCaptureTrace(mode: DriveOutputMode): boolean {
  return mode === "capture" || mode === "live-and-capture";
}

export function shouldPlayLiveAudio(mode: DriveOutputMode): boolean {
  return mode === "live" || mode === "live-and-capture";
}
