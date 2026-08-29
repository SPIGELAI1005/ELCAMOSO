import type { DriveState } from "@/lib/drive/model";

/** Normalized UI/feedback axes shared by Drive chrome and the mark. */
export interface MotionState {
  speedNormalized: number;
  accelerationNormalized: number;
  throttleNormalized: number;
  regenNormalized: number;
  jerkNormalized: number;
  /** 0..1 overall motion energy for UI (not a substitute for engine load). */
  motionEnergy: number;
}

export const IDLE_MOTION: MotionState = {
  speedNormalized: 0,
  accelerationNormalized: 0,
  throttleNormalized: 0,
  regenNormalized: 0,
  jerkNormalized: 0,
  motionEnergy: 0,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const WEIGHTS = {
  acceleration: 0.34,
  throttle: 0.28,
  speed: 0.22,
  jerk: 0.16,
} as const;

/** Instantaneous energy before smoothing. Regen lowers perceived energy. */
export function rawMotionEnergy(state: DriveState): number {
  const accel = clamp01(state.accelerationNormalized);
  const throttle = clamp01(state.throttle);
  const speed = clamp01(state.speedNormalized);
  const jerk = clamp01(Math.abs(state.jerk));
  const regen = clamp01(state.regen);
  const punch =
    WEIGHTS.acceleration * accel +
    WEIGHTS.throttle * throttle +
    WEIGHTS.speed * speed +
    WEIGHTS.jerk * jerk;
  return clamp01(punch * (1 - regen * 0.55));
}

/**
 * Smooth MotionState from DriveState. Pass previous.motionEnergy for continuity.
 * `dt` is seconds; tau ~120 ms so UI feels calm without lagging punch.
 */
export function deriveMotionState(state: DriveState, previousEnergy = 0, dt = 1 / 60): MotionState {
  const target = rawMotionEnergy(state);
  const alpha = 1 - Math.exp(-Math.max(0.001, dt) / 0.12);
  const motionEnergy = previousEnergy + (target - previousEnergy) * alpha;
  return {
    speedNormalized: clamp01(state.speedNormalized),
    accelerationNormalized: clamp01(state.accelerationNormalized),
    throttleNormalized: clamp01(state.throttle),
    regenNormalized: clamp01(state.regen),
    jerkNormalized: clamp01(Math.abs(state.jerk)),
    motionEnergy: clamp01(motionEnergy),
  };
}

/** True when the vehicle is moving enough to enter driving safety UI. */
export function isDrivingSafetySpeed(speedMps: number): boolean {
  return speedMps * 3.6 > 5;
}
