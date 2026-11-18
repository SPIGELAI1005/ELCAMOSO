/**
 * Combine cadence, pace and acceleration into one smoothed effort 0–100.
 * Optional 60 s warm-up walk records a personal baseline so a naturally
 * slow (or high-cadence) runner is not stuck at the bottom (or top).
 */
import { EFFORT_ZONES, zoneForEffort } from "./colors";
import type { EffortZoneId } from "./types";

export interface EffortInput {
  cadenceSpm: number | null;
  /** Filtered ground speed, m/s. */
  speedMps: number | null;
  /** Along-track acceleration, m/s². Positive = speeding up. */
  accelMps2: number | null;
}

export interface EffortCalibration {
  baselineCadenceSpm: number;
  baselineSpeedMps: number;
}

export const WARMUP_MS = 60_000;

const CADENCE_WEIGHT = 0.45;
const PACE_WEIGHT = 0.4;
const ACCEL_WEIGHT = 0.15;
const SMOOTH_TAU_S = 1.6;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Piecewise-linear map through [x,y] breakpoints. */
function piecewise(x: number, points: Array<readonly [number, number]>): number {
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) {
      const t = x1 === x0 ? 1 : (x - x0) / (x1 - x0);
      return lerp(y0, y1, t);
    }
  }
  return points[points.length - 1]![1];
}

/** Default cadence curve: walk 110 ≈ 20, jog 150 ≈ 50, 180 ≈ 85, 200 ≈ 100. */
export function cadenceScore(spm: number, calib?: EffortCalibration | null): number {
  if (!Number.isFinite(spm) || spm <= 0) return 0;
  if (calib && calib.baselineCadenceSpm > 40) {
    const base = calib.baselineCadenceSpm;
    // Baseline walk sits near 22. +70 spm above baseline reaches 100.
    return clamp(22 + ((spm - base) / 70) * 78, 0, 100);
  }
  return piecewise(spm, [
    [80, 0],
    [110, 20],
    [150, 50],
    [180, 85],
    [200, 100],
  ]);
}

/** Default speed curve: 5 km/h ≈ 20, 9 km/h ≈ 50, 12 km/h ≈ 75, 16 km/h ≈ 100. */
export function speedScore(speedMps: number, calib?: EffortCalibration | null): number {
  if (!Number.isFinite(speedMps) || speedMps <= 0) return 0;
  if (calib && calib.baselineSpeedMps > 0.6) {
    const base = calib.baselineSpeedMps;
    // From a walking baseline, +2.8 m/s (~+10 km/h) reaches 100.
    return clamp(22 + ((speedMps - base) / 2.8) * 78, 0, 100);
  }
  return piecewise(speedMps, [
    [0, 0],
    [1.4, 20],
    [2.5, 50],
    [3.33, 75],
    [4.5, 100],
  ]);
}

export function accelScore(accelMps2: number | null): number {
  if (accelMps2 == null || !Number.isFinite(accelMps2)) return 50; // neutral
  return clamp(50 + accelMps2 * 16, 0, 100);
}

/** Unsmooth, pure combination of the three cues. Missing cues are dropped. */
export function instantEffort(input: EffortInput, calib?: EffortCalibration | null): number {
  const parts: Array<{ w: number; s: number }> = [];
  if (input.cadenceSpm != null && input.cadenceSpm > 0) {
    parts.push({ w: CADENCE_WEIGHT, s: cadenceScore(input.cadenceSpm, calib) });
  }
  if (input.speedMps != null && input.speedMps > 0.3) {
    parts.push({ w: PACE_WEIGHT, s: speedScore(input.speedMps, calib) });
  }
  if (input.accelMps2 != null && Number.isFinite(input.accelMps2)) {
    parts.push({ w: ACCEL_WEIGHT, s: accelScore(input.accelMps2) });
  }
  if (parts.length === 0) return 0;
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  const v = parts.reduce((a, p) => a + (p.w / wsum) * p.s, 0);
  return clamp(v, 0, 100);
}

export function effortZoneId(effort: number): EffortZoneId {
  return zoneForEffort(effort).id;
}

export { EFFORT_ZONES };

export class EffortMapper {
  private smoothed = 0;
  private calib: EffortCalibration | null = null;
  private warmupStartMs: number | null = null;
  private warmupCadence: number[] = [];
  private warmupSpeed: number[] = [];

  get calibration(): EffortCalibration | null {
    return this.calib;
  }

  get value(): number {
    return this.smoothed;
  }

  setCalibration(calib: EffortCalibration | null): void {
    this.calib = calib;
  }

  startWarmup(nowMs: number): void {
    this.warmupStartMs = nowMs;
    this.warmupCadence = [];
    this.warmupSpeed = [];
    this.calib = null;
  }

  /** @returns remaining ms, or 0 when finished and calibration has been applied. */
  pushWarmup(nowMs: number, input: EffortInput): number {
    if (this.warmupStartMs == null) return 0;
    if (input.cadenceSpm != null && input.cadenceSpm > 40) this.warmupCadence.push(input.cadenceSpm);
    if (input.speedMps != null && input.speedMps > 0.5) this.warmupSpeed.push(input.speedMps);
    const left = Math.max(0, WARMUP_MS - (nowMs - this.warmupStartMs));
    if (left === 0) this.finishWarmup();
    return left;
  }

  finishWarmup(): EffortCalibration | null {
    this.warmupStartMs = null;
    const cadence = median(this.warmupCadence);
    const speed = median(this.warmupSpeed);
    if (cadence == null && speed == null) {
      this.calib = null;
      return null;
    }
    this.calib = {
      baselineCadenceSpm: cadence ?? 110,
      baselineSpeedMps: speed ?? 1.4,
    };
    return this.calib;
  }

  cancelWarmup(): void {
    this.warmupStartMs = null;
    this.warmupCadence = [];
    this.warmupSpeed = [];
  }

  get warmingUp(): boolean {
    return this.warmupStartMs != null;
  }

  update(input: EffortInput, dtSec: number): number {
    const instant = instantEffort(input, this.calib);
    const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0.05;
    const a = 1 - Math.exp(-dt / SMOOTH_TAU_S);
    this.smoothed += (instant - this.smoothed) * a;
    this.smoothed = clamp(this.smoothed, 0, 100);
    return this.smoothed;
  }

  reset(): void {
    this.smoothed = 0;
    this.cancelWarmup();
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
