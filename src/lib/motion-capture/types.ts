import type { JourneyTraceV1 } from "@/lib/journey-trace";
import type { MotionSample } from "@/lib/motion/types";

export type CaptureQuality = "balanced" | "high-detail";

export interface MotionCaptureStatus {
  active: boolean;
  backgroundCapable: boolean;
  startedAt: number | null;
  durationMs: number;
  sampleCount: number;
  distanceM: number;
  quality: CaptureQuality;
  detail: "full" | "reduced";
  permission: "prompt" | "granted" | "denied";
}

export interface MotionCaptureStartOptions {
  journeyId: string;
  startedAt: number;
  outputMode: JourneyTraceV1["outputMode"];
  captureProfileId: string | null;
  quality: CaptureQuality;
  persistJourney: boolean;
}

export type MotionListener = (sample: MotionSample, receivedAt: number) => void;

export interface MotionCaptureProvider {
  readonly platform: "web" | "native";
  readonly ownsJourneyPersistence: boolean;
  start(options: MotionCaptureStartOptions, listener: MotionListener): Promise<void>;
  stop(): Promise<JourneyTraceV1 | null>;
  getStatus(): Promise<MotionCaptureStatus>;
  drainCompletedJourneys(): Promise<JourneyTraceV1[]>;
  acknowledgeJourneys(journeyIds: string[]): Promise<void>;
  dispose(): void;
}

export const IDLE_CAPTURE_STATUS: MotionCaptureStatus = {
  active: false,
  backgroundCapable: false,
  startedAt: null,
  durationMs: 0,
  sampleCount: 0,
  distanceM: 0,
  quality: "balanced",
  detail: "reduced",
  permission: "prompt",
};
