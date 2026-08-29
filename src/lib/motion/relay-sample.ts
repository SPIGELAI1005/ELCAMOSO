import type { MotionSample, SensorSource } from "@/lib/motion/types";

/** Motion fields safe to relay — no raw latitude/longitude. */
export type RelayMotionPayload = Omit<MotionSample, "latitude" | "longitude">;

export interface RelayMotionMessage {
  type: "motion";
  from: "phone";
  /** Wall clock when the phone sent this frame. */
  at: number;
  seq: number;
  sample: RelayMotionPayload;
  /** Wall clock when the relay server forwarded to display (optional). */
  serverAt?: number;
}

export function toRelayMotionPayload(sample: MotionSample): RelayMotionPayload {
  const out: RelayMotionPayload = {
    timestamp: sample.timestamp,
    source: sample.source satisfies SensorSource,
  };
  if (sample.speedKmh !== undefined) out.speedKmh = round2(sample.speedKmh);
  if (sample.accelerationLongitudinal !== undefined) {
    out.accelerationLongitudinal = round3(sample.accelerationLongitudinal);
  }
  if (sample.accelerationLateral !== undefined) {
    out.accelerationLateral = round3(sample.accelerationLateral);
  }
  if (sample.heading !== undefined) out.heading = round1(sample.heading);
  if (sample.accuracy !== undefined) out.accuracy = round1(sample.accuracy);
  if (sample.gyroX !== undefined) out.gyroX = round3(sample.gyroX);
  if (sample.gyroY !== undefined) out.gyroY = round3(sample.gyroY);
  if (sample.gyroZ !== undefined) out.gyroZ = round3(sample.gyroZ);
  return out;
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}
function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}
