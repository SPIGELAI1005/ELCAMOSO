import type { MotionSample } from "@/lib/motion/types";

/** Target relay rate — keep within server cap (~22/s) and network budget. */
export const PHONE_SENSOR_TARGET_HZ = 15;
export const PHONE_SENSOR_TICK_MS = Math.round(1000 / PHONE_SENSOR_TARGET_HZ);
export const PHONE_SENSOR_CALIBRATION_MS = 2500;

const MAX_ACCEL_MS2 = 15;
const MAX_GYRO_DPS = 720;
const MAX_SPEED_KMH = 280;

export interface PhoneSensorFrame {
  speedMs: number;
  accelLong: number;
  accelLat: number;
  heading: number | null;
  accuracyM: number | null;
  gyroX: number | null;
  gyroY: number | null;
  gyroZ: number | null;
  gpsAt: number;
  imuAt: number;
}

export function applyAccelDeadband(value: number, noiseFloor: number, ratio = 0.35): number {
  const threshold = noiseFloor * ratio;
  return Math.abs(value) < threshold ? 0 : value;
}

export function clampAccelMs2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_ACCEL_MS2, Math.min(MAX_ACCEL_MS2, value));
}

export function clampGyroDps(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(-MAX_GYRO_DPS, Math.min(MAX_GYRO_DPS, value));
}

export function normalizeHeading(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function headingFromOrientation(event: DeviceOrientationEvent): number | null {
  const webkit = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (
    typeof webkit.webkitCompassHeading === "number" &&
    Number.isFinite(webkit.webkitCompassHeading)
  ) {
    return normalizeHeading(webkit.webkitCompassHeading);
  }
  if (typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
    return normalizeHeading((360 - event.alpha) % 360);
  }
  return null;
}

/** Derive IMU noise floor from idle magnitude samples (60th percentile). */
export function computeNoiseFloor(samples: number[], fallback = 0): number {
  if (!samples.length) return fallback;
  const sorted = [...samples].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return fallback;
  return sorted[Math.floor(sorted.length * 0.6)] ?? fallback;
}

export function buildPhoneMotionSample(
  frame: PhoneSensorFrame,
  nowPerfMs: number,
): MotionSample | null {
  const gpsAge = frame.gpsAt ? nowPerfMs - frame.gpsAt : Infinity;
  const imuAge = frame.imuAt ? nowPerfMs - frame.imuAt : Infinity;
  if (gpsAge > 8000 && imuAge > 800) return null;

  const speedKmh = Math.max(0, Math.min(MAX_SPEED_KMH, frame.speedMs * 3.6));

  return {
    timestamp: Date.now(),
    source: "phone",
    speedKmh: round2(speedKmh),
    accelerationLongitudinal: round3(frame.accelLong),
    accelerationLateral: round3(frame.accelLat),
    ...(frame.heading !== null ? { heading: round1(normalizeHeading(frame.heading)) } : {}),
    ...(frame.accuracyM !== null ? { accuracy: round1(frame.accuracyM) } : {}),
    ...(frame.gyroX !== null ? { gyroX: round3(frame.gyroX) } : {}),
    ...(frame.gyroY !== null ? { gyroY: round3(frame.gyroY) } : {}),
    ...(frame.gyroZ !== null ? { gyroZ: round3(frame.gyroZ) } : {}),
  };
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
