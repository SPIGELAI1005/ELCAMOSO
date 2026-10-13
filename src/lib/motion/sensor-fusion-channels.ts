import type { MotionSample, SensorSource } from "@/lib/motion/types";

/** Logical ingress channels - mapped onto MotionSample fields, not separate wire types. */
export type FusionInputChannel =
  "tesla-browser-gps" | "tesla-browser-imu" | "phone-gps" | "phone-imu" | "vehicle-telemetry";

export interface FusionChannelStatus {
  channel: FusionInputChannel;
  active: boolean;
  ageMs: number | null;
}

const SOURCE_FOR_CHANNEL: Record<FusionInputChannel, SensorSource> = {
  "tesla-browser-gps": "tesla-browser",
  "tesla-browser-imu": "tesla-browser",
  "phone-gps": "phone",
  "phone-imu": "phone",
  "vehicle-telemetry": "vehicle-telemetry",
};

/** Speed baseline priority (first = highest). IMU channels are never speed baselines. */
export const SPEED_CHANNEL_PRIORITY: FusionInputChannel[] = [
  "vehicle-telemetry",
  "phone-gps",
  "tesla-browser-gps",
];

export function sourceForChannel(channel: FusionInputChannel): SensorSource {
  return SOURCE_FOR_CHANNEL[channel];
}

export function sampleHasGpsSpeed(sample: MotionSample): boolean {
  return sample.speedKmh !== undefined && Number.isFinite(sample.speedKmh);
}

export function sampleHasImuAccel(sample: MotionSample): boolean {
  return (
    sample.accelerationLongitudinal !== undefined &&
    Number.isFinite(sample.accelerationLongitudinal)
  );
}

export function sampleHasGyro(sample: MotionSample): boolean {
  return (
    (sample.gyroX !== undefined && Number.isFinite(sample.gyroX)) ||
    (sample.gyroY !== undefined && Number.isFinite(sample.gyroY)) ||
    (sample.gyroZ !== undefined && Number.isFinite(sample.gyroZ))
  );
}

/** Which logical channels a sample contributes to (may be multiple for phone relay frames). */
export function channelsFromSample(sample: MotionSample): FusionInputChannel[] {
  const out: FusionInputChannel[] = [];
  switch (sample.source) {
    case "tesla-browser":
      if (sampleHasGpsSpeed(sample)) out.push("tesla-browser-gps");
      if (sampleHasImuAccel(sample)) out.push("tesla-browser-imu");
      break;
    case "phone":
      if (sampleHasGpsSpeed(sample)) out.push("phone-gps");
      if (sampleHasImuAccel(sample)) out.push("phone-imu");
      break;
    case "vehicle-telemetry":
      out.push("vehicle-telemetry");
      break;
    default:
      break;
  }
  return out;
}

/** Align wall-clock ingest time with sample timestamp for interpolation. */
export function alignReceivedAt(sampleTimestamp: number, receivedAt: number): number {
  if (!Number.isFinite(sampleTimestamp) || sampleTimestamp <= 0) return receivedAt;
  const skew = receivedAt - sampleTimestamp;
  if (Math.abs(skew) > 60_000) return receivedAt;
  return receivedAt;
}

/**
 * Dead-reckon speed from last GPS fix using IMU acceleration.
 * Applies stronger extrapolation when IMU is fresh and trusted.
 *
 * @param speedMs - Last known speed in m/s
 * @param accelMs2 - Longitudinal acceleration from IMU
 * @param ageMs - Time since last GPS fix
 * @param maxAgeMs - Maximum age for extrapolation (default 1200ms)
 * @param imuTrustFactor - 0..1 confidence in IMU data (default 0.5)
 */
export function extrapolateSpeedMs(
  speedMs: number,
  accelMs2: number | null,
  ageMs: number,
  maxAgeMs = 1200,
  imuTrustFactor = 0.5,
): number {
  if (ageMs <= 0 || ageMs > maxAgeMs) return speedMs;
  if (accelMs2 === null || !Number.isFinite(accelMs2)) return speedMs;

  const dtSec = ageMs / 1000;
  const ageFrac = Math.min(1, ageMs / maxAgeMs);
  const blendFactor = 0.18 + imuTrustFactor * 0.42 * (1 - ageFrac * 0.5);
  const delta = accelMs2 * dtSec * blendFactor;

  return Math.max(0, speedMs + delta);
}
