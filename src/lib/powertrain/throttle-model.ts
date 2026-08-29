import type { VehicleMotionState } from "@/lib/motion/types";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface ThrottleModelState {
  throttle: number;
  load: number;
  previousAccel: number;
}

export function createThrottleModelState(): ThrottleModelState {
  return { throttle: 0, load: 0, previousAccel: 0 };
}

function inferFromAcceleration(accel: number, speedKmh: number): number {
  if (accel <= 0) return 0;
  const fromAccel = clamp01(accel / 3.2);
  const fromSpeed = clamp01(speedKmh / 140) * 0.15;
  if (accel < 0.6) return clamp01(fromAccel * 0.35 + fromSpeed);
  if (accel < 1.8) return clamp01(0.12 + fromAccel * 0.55);
  if (accel < 3.2) return clamp01(0.35 + fromAccel * 0.65);
  return clamp01(0.65 + fromAccel * 0.35);
}

function smoothToward(current: number, target: number, dt: number, tau: number): number {
  const a = 1 - Math.exp(-Math.max(0.001, dt) / Math.max(0.01, tau));
  return current + (target - current) * a;
}

export interface ThrottleModelInput {
  motion: VehicleMotionState;
  profile: PowertrainProfile;
  /** Optional direct pedal from simulator (0..1). */
  directThrottle?: number;
  /** Optional braking demand (0..1) reduces throttle target. */
  braking?: number;
  rpmNormalized: number;
  dt: number;
  state: ThrottleModelState;
}

export interface ThrottleModelResult {
  throttle: number;
  load: number;
  state: ThrottleModelState;
}

/** Attack/release filtered throttle and RPM+pedal-derived load. */
export function updateThrottleModel(input: ThrottleModelInput): ThrottleModelResult {
  const { motion, profile, dt, rpmNormalized } = input;
  const braking = clamp01(input.braking ?? 0);
  const phoneImuLive = motion.sourceHealth.phone;
  const accelForInference = phoneImuLive
    ? Math.max(motion.accelerationFiltered, motion.accelerationMs2 * 0.9)
    : motion.accelerationFiltered;
  const inferred = inferFromAcceleration(accelForInference, motion.speedKmh);
  const direct = clamp01(input.directThrottle ?? motion.inferredThrottle);
  const blend = profile.throttle.directWeight;
  let target = clamp01(inferred * (1 - blend) + direct * blend);
  target = clamp01(target * (1 - braking * 0.95));

  const rising = target > input.state.throttle;
  let tau = rising ? profile.throttle.attackTau : profile.throttle.releaseTau;
  if (rising && phoneImuLive && motion.accelerationMs2 > motion.accelerationFiltered + 0.08) {
    tau *= 0.28;
  }
  const inResilienceHold =
    motion.fallbackTier === "hold" || motion.fallbackTier === "decay" || motion.transitioning;
  if (inResilienceHold && !rising) {
    tau *= 2.4;
  } else if (inResilienceHold && rising && target > input.state.throttle * 0.5) {
    tau *= 0.75;
  }
  const throttle = smoothToward(
    input.state.throttle,
    target,
    dt,
    tau / profile.behavior.engineResponse,
  );

  const rpmLoad = rpmNormalized * 0.45;
  const pedalLoad = throttle * 0.55;
  const transientBoost =
    phoneImuLive && motion.accelerationMs2 > 0.8 ? clamp01(motion.accelerationMs2 / 4.5) * 0.12 : 0;
  const load = clamp01(
    (rpmLoad + pedalLoad + transientBoost) * (0.85 + profile.behavior.engineResponse * 0.15),
  );

  const next: ThrottleModelState = {
    throttle,
    load,
    previousAccel: motion.accelerationFiltered,
  };

  return { throttle, load, state: next };
}
