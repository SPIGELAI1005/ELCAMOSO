import type { VehicleMotionState } from "@/lib/motion/types";
import type { PowertrainProfile } from "@/lib/powertrain/types-config";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface DriverDemandState {
  driverDemand: number;
  engineLoad: number;
  previousAccel: number;
  /** Smoothed accel used for jerk. */
  accelFiltered: number;
}

export function createDriverDemandState(): DriverDemandState {
  return { driverDemand: 0, engineLoad: 0, previousAccel: 0, accelFiltered: 0 };
}

function smoothToward(current: number, target: number, dt: number, tau: number): number {
  const a = 1 - Math.exp(-Math.max(0.001, dt) / Math.max(0.01, tau));
  return current + (target - current) * a;
}

/**
 * Steady road-load proxy (rolling + aero). Kept deliberately small so
 * 100 km/h cruise is not mistaken for ~50% throttle.
 */
export function roadLoadEstimate(speedKmh: number): number {
  const v = Math.max(0, speedKmh);
  // ~0.04 at 50, ~0.07 at 100, ~0.10 at 140 - never the primary demand signal.
  return clamp01((v / 160) * 0.08 + (v / 220) ** 2 * 0.06);
}

function demandFromAcceleration(accel: number, jerk: number): number {
  if (accel <= 0.05 && jerk <= 0.05) return 0;
  const fromAccel =
    accel < 0.55
      ? clamp01(accel / 3.4) * 0.32
      : accel < 1.6
        ? clamp01(0.1 + (accel / 3.4) * 0.55)
        : accel < 3.0
          ? clamp01(0.32 + (accel / 3.8) * 0.55)
          : clamp01(0.62 + (accel / 5) * 0.38);
  const fromJerk = clamp01(Math.max(0, jerk) / 6) * 0.18;
  return clamp01(fromAccel + fromJerk);
}

export interface DriverDemandInput {
  motion: VehicleMotionState;
  profile: PowertrainProfile;
  /** Highest-priority pedal when vehicle telemetry / demo pedals provide it. */
  pedalPosition?: number;
  /** Direct simulator / audition pedal (after telemetry). */
  directThrottle?: number;
  braking?: number;
  rpmNormalized: number;
  dt: number;
  state: DriverDemandState;
}

export interface DriverDemandResult {
  /** Accelerator / intention proxy (0..1). */
  driverDemand: number;
  /** Virtual power needed at current speed/accel (0..1). */
  engineLoad: number;
  state: DriverDemandState;
}

/**
 * Separates driver intention from road-speed and engine load.
 * Priority: vehicle pedal telemetry → directThrottle → IMU accel/jerk (+ tiny road load).
 */
export function updateDriverDemand(input: DriverDemandInput): DriverDemandResult {
  const { motion, profile, dt, rpmNormalized } = input;
  const braking = clamp01(input.braking ?? 0);
  const phoneImuLive = motion.sourceHealth.phone;
  const accelForInference = phoneImuLive
    ? Math.max(motion.accelerationFiltered, motion.accelerationMs2 * 0.9)
    : motion.accelerationFiltered;

  const accelFiltered = smoothToward(input.state.accelFiltered, accelForInference, dt, 0.08);
  const jerk = (accelFiltered - input.state.accelFiltered) / Math.max(0.008, dt);

  const fromMotion = demandFromAcceleration(accelFiltered, jerk);
  const road = roadLoadEstimate(motion.speedKmh);

  let target: number;
  if (input.pedalPosition != null && Number.isFinite(input.pedalPosition)) {
    target = clamp01(input.pedalPosition);
  } else if (input.directThrottle != null && Number.isFinite(input.directThrottle)) {
    // Prefer explicit pedal; blend a little motion so lifts still feel alive.
    target = clamp01(input.directThrottle * 0.92 + fromMotion * 0.08);
  } else {
    // Fusion inferredThrottle may still embed old speed bias - prefer accel path.
    // Do NOT fold road-load into driverDemand (that belongs in engineLoad only).
    const inferred = clamp01(motion.inferredThrottle);
    const blend = profile.throttle.directWeight;
    target = clamp01(fromMotion * (1 - blend * 0.35) + inferred * (blend * 0.35));
  }

  target = clamp01(target * (1 - braking * 0.95));

  const rising = target > input.state.driverDemand;
  let tau = rising ? profile.throttle.attackTau : profile.throttle.releaseTau;
  if (rising && phoneImuLive && motion.accelerationMs2 > motion.accelerationFiltered + 0.08) {
    tau *= 0.28;
  }
  const inResilienceHold =
    motion.fallbackTier === "hold" || motion.fallbackTier === "decay" || motion.transitioning;
  if (inResilienceHold && !rising) {
    tau *= 2.4;
  } else if (inResilienceHold && rising && target > input.state.driverDemand * 0.5) {
    tau *= 0.75;
  }

  const driverDemand = smoothToward(
    input.state.driverDemand,
    target,
    dt,
    tau / profile.behavior.engineResponse,
  );

  // Engine load: power needed = road load + accel demand + light RPM contribution.
  const accelLoad = clamp01(Math.max(0, accelFiltered) / 3.6);
  const rpmLoad = rpmNormalized * 0.22;
  const demandLoad = driverDemand * 0.55;
  const transientBoost =
    phoneImuLive && motion.accelerationMs2 > 0.8 ? clamp01(motion.accelerationMs2 / 4.5) * 0.1 : 0;
  const engineLoad = clamp01(
    (road * 0.55 + accelLoad * 0.35 + demandLoad + rpmLoad * 0.25 + transientBoost) *
      (0.85 + profile.behavior.engineResponse * 0.15),
  );

  const next: DriverDemandState = {
    driverDemand,
    engineLoad,
    previousAccel: accelFiltered,
    accelFiltered,
  };

  return { driverDemand, engineLoad, state: next };
}
