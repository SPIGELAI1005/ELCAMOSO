/**
 * Map running pace onto the Drive music engine's speed-gate range.
 *
 * Visible zones stay Walk / Easy / Steady / Push / Hard. Internally we use
 * 12 continuous levels so Viral Mix (and any other speed-gated pack) can
 * bring instruments in progressively, the way a car does in Drive.
 *
 * Calibration (George): Hard is reserved for strong / sprint efforts and
 * corresponds to Drive music above ~80 km/h (brass, then lead/fx). Typical
 * easy jogging lands mid-range (Steady). Hard starts at 16 km/h (3:45 / km).
 */
import { zoneForEffort } from "./colors";
import type { EffortZoneId } from "./types";

export const INTERNAL_LEVEL_COUNT = 12;
export const HARD_RUNNING_KMH = 16;
export const HARD_PACE_SEC_PER_KM = 225; // 3:45 / km
export const HARD_DRIVE_KMH = 80;
export const MUSIC_INTENSITY_TAU_S = 3.6;
export const STANDSTILL_KMH = 1.8;

/**
 * Running pace breakpoints (km/h) for internal levels 0–11, and the Drive
 * speed each level should present to the pack's speed gates.
 *
 * Level 9 = 16 km/h = Drive 80 km/h = start of Hard / brass.
 */
export const RUNNING_KMH_FOR_LEVEL = [0, 4, 5.5, 6.5, 8, 9.5, 11, 13, 14.5, 16, 18, 20] as const;
export const DRIVE_KMH_FOR_LEVEL = [0, 10, 22, 32, 42, 52, 62, 72, 78, 80, 118, 136] as const;

export interface RunningMusicInput {
  /** Filtered ground speed, m/s. */
  speedMps: number | null;
  cadenceSpm?: number | null;
}

export interface RunningMusicMapping {
  runningKmh: number;
  /** Continuous 0–11, pace-primary. */
  level: number;
  /** Integer 0–11. */
  levelIndex: number;
  driveSpeedKmh: number;
  visibleZone: EffortZoneId;
  /** Visible effort 0–100, aligned with the five zone boundaries. */
  visibleEffort: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolate(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]!) {
      const t = xs[i] === xs[i - 1] ? 1 : (x - xs[i - 1]!) / (xs[i]! - xs[i - 1]!);
      return lerp(ys[i - 1]!, ys[i]!, t);
    }
  }
  return ys[ys.length - 1]!;
}

export function mpsToKmh(speedMps: number | null | undefined): number {
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps <= 0) return 0;
  return speedMps * 3.6;
}

/** Visible effort 0–100 from running km/h. Hard (80) begins at 16 km/h. */
export function visibleEffortFromRunningKmh(kmh: number): number {
  const x = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  return interpolate(
    x,
    [0, 5, 6.5, 8.5, 12, HARD_RUNNING_KMH, 18, 20],
    [0, 18, 25, 45, 65, 80, 92, 100],
  );
}

/** Continuous internal level 0–11 from running km/h (pace only). */
export function paceLevelFromRunningKmh(kmh: number): number {
  const x = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  return interpolate(
    x,
    RUNNING_KMH_FOR_LEVEL,
    RUNNING_KMH_FOR_LEVEL.map((_, i) => i),
  );
}

/**
 * Cadence can nudge the level slightly but cannot, on its own, put a walker
 * into Hard. 110 spm ≈ walk, 150 ≈ steady jog, 180 ≈ push.
 */
export function cadenceLevel(spm: number | null | undefined): number | null {
  if (spm == null || !Number.isFinite(spm) || spm <= 0) return null;
  return interpolate(spm, [80, 110, 150, 175, 200], [0, 2, 5, 7.2, 9]);
}

export function driveSpeedKmhFromLevel(level: number): number {
  const lvl = clamp(level, 0, INTERNAL_LEVEL_COUNT - 1);
  return interpolate(
    lvl,
    RUNNING_KMH_FOR_LEVEL.map((_, i) => i),
    DRIVE_KMH_FOR_LEVEL,
  );
}

export function mapRunningToMusic(input: RunningMusicInput): RunningMusicMapping {
  const runningKmh = mpsToKmh(input.speedMps);
  let level = paceLevelFromRunningKmh(runningKmh);
  const cad = cadenceLevel(input.cadenceSpm);
  if (cad != null) {
    // Pace is primary. Cadence may nudge up to about one level, and cannot
    // lift a below-Push pace into Hard.
    const blended = level * 0.85 + cad * 0.15;
    const cap = runningKmh < HARD_RUNNING_KMH ? 8.6 : INTERNAL_LEVEL_COUNT - 1;
    level = clamp(blended, 0, cap);
  }
  if (runningKmh < STANDSTILL_KMH) level = 0;
  const driveSpeedKmh = runningKmh < STANDSTILL_KMH ? 0 : driveSpeedKmhFromLevel(level);
  const visibleEffort = visibleEffortFromRunningKmh(runningKmh);
  return {
    runningKmh,
    level,
    levelIndex: clamp(Math.round(level), 0, INTERNAL_LEVEL_COUNT - 1),
    driveSpeedKmh,
    visibleZone: zoneForEffort(visibleEffort).id,
    visibleEffort,
  };
}

export function movementFromDriveSpeed(driveSpeedKmh: number, dDriveKmhPerSec: number): import("@/lib/symphony/types").MovementState {
  if (driveSpeedKmh < 8) return "stopped";
  if (dDriveKmhPerSec <= -12) return "decelerating";
  if (driveSpeedKmh >= 125) return "peak";
  if (dDriveKmhPerSec >= 12 || driveSpeedKmh >= 100) return "building";
  if (driveSpeedKmh >= 88) return "energetic";
  if (driveSpeedKmh >= 42) return "cruise";
  return "calm";
}

/**
 * Smooths Drive-equivalent speed with a ~3.6 s time constant (settles in
 * about 3–5 s). Standstill decays to 0 and a small deadband ignores GPS jitter.
 */
export class MusicIntensitySmoother {
  private value = 0;
  private lastTarget = 0;
  private tauS: number;

  constructor(tauS = MUSIC_INTENSITY_TAU_S) {
    this.tauS = tauS;
  }

  get driveSpeedKmh(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.lastTarget = 0;
  }

  update(targetKmh: number, dtSec: number, runningKmh = targetKmh): number {
    const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0.05;
    const target = Number.isFinite(targetKmh) && targetKmh > 0 ? targetKmh : 0;
    if (runningKmh < STANDSTILL_KMH) {
      const a = 1 - Math.exp(-dt / Math.min(this.tauS, 1.4));
      this.value += (0 - this.value) * a;
      if (this.value < 4) this.value = 0;
      this.lastTarget = 0;
      return this.value;
    }
    // Ignore GPS jitter around a stable pace; still approach a real step change.
    if (Math.abs(target - this.lastTarget) < 2.5) {
      if (Math.abs(this.value - this.lastTarget) < 1.5) return this.value;
    } else {
      this.lastTarget = target;
    }
    const a = 1 - Math.exp(-dt / this.tauS);
    this.value += (this.lastTarget - this.value) * a;
    if (Math.abs(this.lastTarget - this.value) < 0.6) this.value = this.lastTarget;
    if (this.value < 0) this.value = 0;
    return this.value;
  }
}

