import { lowPassToward, rejectSpike } from "@/lib/motion/filters";
import type { SensorSource } from "@/lib/motion/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Telemetry samples older than this are treated as lagged for correction tuning. */
export const TELEMETRY_LAG_MS = 450;
/** Speed disagreement (m/s) before conflict limiting applies. */
export const SPEED_CONFLICT_MS = 4.5;
/** Max speed correction toward anchor per second (avoids jumps). */
export const MAX_SPEED_CORRECTION_MS = 2.8;
/** Max accel correction toward anchor per second. */
export const MAX_ACCEL_CORRECTION = 3.2;

const ANCHOR_TAU: Record<SensorSource, number> = {
  "vehicle-telemetry": 0.32,
  phone: 0.36,
  "tesla-browser": 0.42,
  simulator: 0.4,
};

export interface SpeedFusionInput {
  anchorTargetMs: number | null;
  anchorSource: SensorSource | null;
  currentAnchorMs: number;
  currentFilteredMs: number;
  phoneImuAccelMs2: number | null;
  conflictGapMs: number;
  telemetryAgeMs: number | null;
  dt: number;
  reconnectBlend: boolean;
  tierBlend: number;
  holdSpeedMs: number;
}

export interface SpeedFusionResult {
  anchorMs: number;
  filteredMs: number;
}

export interface AccelFusionInput {
  /** Phone or browser IMU longitudinal accel (m/s²). */
  imuAccelMs2: number | null;
  telemetryAccelMs2: number | null;
  currentTransientMs2: number;
  currentAnchorMs2: number;
  telemetryAgeMs: number | null;
  dt: number;
  reconnectBlend: boolean;
  maxSpike: number;
}

export interface AccelFusionResult {
  transientMs2: number;
  anchorMs2: number;
}

function telemetryLagFactor(telemetryAgeMs: number | null): number {
  if (telemetryAgeMs === null) return 0;
  if (telemetryAgeMs <= TELEMETRY_LAG_MS) return 0;
  return clamp01((telemetryAgeMs - TELEMETRY_LAG_MS) / 900);
}

function anchorTauForSource(
  source: SensorSource | null,
  telemetryAgeMs: number | null,
  reconnectBlend: boolean,
): number {
  const base = source ? ANCHOR_TAU[source] : 0.4;
  const lag = telemetryLagFactor(telemetryAgeMs);
  const reconnect = reconnectBlend ? 0.18 : 0;
  return base + lag * 0.42 + reconnect;
}

function correctionTau(
  telemetryAgeMs: number | null,
  conflictGapMs: number,
  reconnectBlend: boolean,
): number {
  const lag = telemetryLagFactor(telemetryAgeMs);
  const conflict = clamp01(conflictGapMs / 12);
  const base = 0.34 + lag * 0.38 + conflict * 0.28;
  return reconnectBlend ? base + 0.22 : base;
}

/** Slow authoritative speed anchor + fast IMU layer corrected without abrupt jumps. */
export function fuseSpeedLayers(input: SpeedFusionInput): SpeedFusionResult {
  const dt = Math.min(0.25, Math.max(0.001, input.dt));
  let anchorMs = input.currentAnchorMs;
  let filteredMs = input.currentFilteredMs;

  if (input.anchorTargetMs !== null && input.anchorSource) {
    const tau = anchorTauForSource(input.anchorSource, input.telemetryAgeMs, input.reconnectBlend);
    let target = input.anchorTargetMs;
    if (input.tierBlend < 1 && input.holdSpeedMs > 0) {
      target = input.holdSpeedMs + (target - input.holdSpeedMs) * input.tierBlend;
    }
    anchorMs = lowPassToward(anchorMs, target, dt, tau);
  }

  if (input.phoneImuAccelMs2 !== null && input.phoneImuAccelMs2 > 0) {
    filteredMs = Math.max(0, filteredMs + input.phoneImuAccelMs2 * dt * 0.35);
  }

  if (input.anchorTargetMs !== null) {
    const error = anchorMs - filteredMs;
    const conflictDampen = 1 - clamp01(input.conflictGapMs / 14) * 0.5;
    const maxStep = MAX_SPEED_CORRECTION_MS * dt * conflictDampen;
    // When the fast layer leads the anchor, correct gently so transients stay ahead.
    const leadFactor = error < 0 ? 0.38 : 1;
    const step = Math.sign(error) * Math.min(Math.abs(error), maxStep) * leadFactor;
    filteredMs = Math.max(0, filteredMs + step);
    // Let anchor follow a leading fast layer only - never drag it below the target baseline.
    if (input.phoneImuAccelMs2 !== null && input.phoneImuAccelMs2 > 0.08 && filteredMs > anchorMs) {
      const tau = correctionTau(input.telemetryAgeMs, input.conflictGapMs, input.reconnectBlend);
      anchorMs = lowPassToward(anchorMs, filteredMs, dt, tau * 1.15);
    }
  }

  return { anchorMs, filteredMs };
}

/**
 * Phone IMU supplies fast transients; vehicle telemetry supplies slow accurate anchor.
 * Anchor gently pulls transients into alignment without killing leading phone spikes.
 */
export function fuseAccelLayers(input: AccelFusionInput): AccelFusionResult {
  const dt = Math.min(0.25, Math.max(0.001, input.dt));
  let anchorMs2 = input.currentAnchorMs2;
  let transientMs2 = input.currentTransientMs2;

  if (input.telemetryAccelMs2 !== null) {
    const lag = telemetryLagFactor(input.telemetryAgeMs);
    const anchorTau = 0.26 + lag * 0.4 + (input.reconnectBlend ? 0.16 : 0);
    anchorMs2 = lowPassToward(anchorMs2, input.telemetryAccelMs2, dt, anchorTau);
  }

  if (input.imuAccelMs2 !== null) {
    const { value, rejected } = rejectSpike(input.imuAccelMs2, transientMs2, input.maxSpike);
    transientMs2 = lowPassToward(transientMs2, rejected ? transientMs2 : value, dt, 0.1);
  } else if (input.telemetryAccelMs2 !== null) {
    transientMs2 = lowPassToward(transientMs2, anchorMs2, dt, 0.22);
  }

  if (input.telemetryAccelMs2 !== null && input.imuAccelMs2 !== null) {
    const error = anchorMs2 - transientMs2;
    const maxStep = MAX_ACCEL_CORRECTION * dt;
    // Phone IMU may lead; pull toward telemetry anchor without killing the spike.
    const leadFactor = error < 0 ? 0.42 : 1;
    const step = Math.sign(error) * Math.min(Math.abs(error), maxStep) * leadFactor;
    const tau = correctionTau(input.telemetryAgeMs, Math.abs(error), input.reconnectBlend);
    transientMs2 = lowPassToward(transientMs2, transientMs2 + step, dt, tau);
  }

  return { transientMs2, anchorMs2 };
}

export function speedConflictGapMs(
  telemetrySpeedMs: number | null,
  phoneSpeedMs: number | null,
): number {
  if (telemetrySpeedMs === null || phoneSpeedMs === null) return 0;
  return Math.abs(telemetrySpeedMs - phoneSpeedMs);
}

export function hasSpeedConflict(gapMs: number): boolean {
  return gapMs > SPEED_CONFLICT_MS;
}
