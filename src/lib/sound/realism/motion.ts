import type { DriveState } from "@/lib/drive/model";
import { resolveDrivetrain } from "@/lib/drive/drivetrain-resolve";
import { clamp, powCurve, smoothstep } from "@/lib/sound/dsp/math";
import { createDualSmoother, smoothToward, type DualSmootherState } from "@/lib/sound/dsp/smoother";
import { computeDynamicLayerWeights } from "@/lib/sound/dynamic-drive/layer-weights";
import type { SoundProfile } from "@/lib/sound/profiles";
import { familyForProfile } from "@/lib/sound/realism/families";
import type { MotionFrame } from "@/lib/sound/realism/types";

export interface MotionTracker {
  speed: DualSmootherState;
  accel: DualSmootherState;
  throttle: DualSmootherState;
  lastAccel: number;
  lastGear: number;
  shiftDip: number;
  lastTime: number;
}

export function createMotionTracker(): MotionTracker {
  return {
    speed: createDualSmoother(0),
    accel: createDualSmoother(0),
    throttle: createDualSmoother(0),
    lastAccel: 0,
    lastGear: 0,
    shiftDip: 0,
    lastTime: 0,
  };
}

/** Maps throttle, acceleration, and positive jerk into load-like energy for continuous profiles. */
export function computeSyntheticLoad(
  state: DriveState,
  tracker: MotionTracker,
  jerkNorm: number,
): number {
  const cruiseFloor = clamp(tracker.speed.slow * 0.12, 0, 0.18);
  const intent = clamp(
    tracker.throttle.fast * 0.48 +
      tracker.accel.fast * 0.34 +
      Math.max(0, jerkNorm) * 0.18 -
      state.regen * 0.28,
    0,
    1,
  );
  return Math.max(cruiseFloor, intent);
}

export function motionFromDrive(
  state: DriveState,
  profile: SoundProfile,
  tracker: MotionTracker,
  audioTime: number,
): MotionFrame {
  const dt = tracker.lastTime > 0 ? clamp(audioTime - tracker.lastTime, 0.004, 0.08) : 1 / 60;
  tracker.lastTime = audioTime;
  const family = familyForProfile(profile);
  const drivetrain =
    profile.drivetrainMode === "virtual-transmission" ? resolveDrivetrain(profile) : null;

  const speedKmh = state.speed * 3.6;
  const speedNorm = clamp(speedKmh / 160);
  const speedSlowTau =
    drivetrain?.motion.speedSlowTau ??
    (family === "environmental" || family === "musical" ? 0.4 : family === "designed" ? 0.7 : 0.55);
  const throttleFastTau = family === "physical" ? 0.04 : family === "designed" ? 0.08 : 0.06;
  tracker.speed.fast = smoothToward(tracker.speed.fast, speedNorm, dt, 0.12);
  tracker.speed.slow = smoothToward(tracker.speed.slow, speedNorm, dt, speedSlowTau);

  const accelNorm = clamp(Math.abs(state.acceleration) / 4.5);
  tracker.accel.fast = smoothToward(tracker.accel.fast, accelNorm, dt, 0.05);
  tracker.accel.slow = smoothToward(tracker.accel.slow, accelNorm, dt, 0.35);

  tracker.throttle.fast = smoothToward(tracker.throttle.fast, state.throttle, dt, throttleFastTau);
  tracker.throttle.slow = smoothToward(tracker.throttle.slow, state.throttle, dt, 0.22);

  const jerk = (state.acceleration - tracker.lastAccel) / Math.max(dt, 0.008);
  const jerkNorm = clamp(jerk / 30, -1, 1);
  tracker.lastAccel = state.acceleration;

  const syntheticLoad = computeSyntheticLoad(state, tracker, Math.max(0, jerkNorm));

  const pt = state.powertrain;
  const usePowertrain =
    pt != null && family === "physical" && profile.drivetrainMode === "virtual-transmission";

  let isShifting =
    family === "physical" &&
    profile.drivetrainMode === "virtual-transmission" &&
    tracker.lastGear !== 0 &&
    state.gear !== 0 &&
    tracker.lastGear !== state.gear;

  if (usePowertrain) {
    isShifting = pt.shifting;
    if (pt.shifting) {
      const dip = pt.shiftDirection === "up" ? 0.32 : 0.14;
      tracker.shiftDip = Math.max(tracker.shiftDip, dip * (1 - (pt.shiftProgress ?? 0)));
    }
  } else if (isShifting) {
    tracker.shiftDip = 1;
  }
  tracker.shiftDip = smoothToward(tracker.shiftDip, 0, dt, 0.09);
  tracker.lastGear = state.gear;

  const tx = profile.transmission;
  let virtualRpm = state.rpm;
  let rpmNorm = 0;
  let engineFundamentalHz = profile.voice.baseFrequency;
  const motionModel = profile.motionModel;

  if (
    family === "environmental" ||
    family === "musical" ||
    motionModel === "ambient" ||
    motionModel === "cadence"
  ) {
    virtualRpm = 0;
    rpmNorm = 0;
    engineFundamentalHz = profile.voice.baseFrequency;
  } else if (profile.id === "wiesn-tractor" && tx) {
    virtualRpm = Math.max(tx.idleRpm * 0.9, Math.min(tx.redlineRpm, state.rpm || tx.idleRpm));
    rpmNorm = clamp((virtualRpm - tx.idleRpm) / Math.max(1, tx.redlineRpm - tx.idleRpm));
    engineFundamentalHz = virtualRpm / 60;
  } else if (profile.drivetrainMode === "virtual-transmission" && tx) {
    if (usePowertrain && pt) {
      virtualRpm = Math.max(tx.idleRpm * 0.85, pt.rpm || tx.idleRpm);
      rpmNorm = clamp(
        pt.normalizedRpm || (virtualRpm - tx.idleRpm) / Math.max(1, tx.redlineRpm - tx.idleRpm),
      );
    } else {
      virtualRpm = Math.max(tx.idleRpm * 0.85, state.rpm || tx.idleRpm);
      rpmNorm = clamp((virtualRpm - tx.idleRpm) / Math.max(1, tx.redlineRpm - tx.idleRpm));
    }
    engineFundamentalHz = (virtualRpm / 60) * (profile.voice.baseFrequency / 26);
  } else if (family === "designed") {
    // Acceleration weights energy more than absolute speed
    virtualRpm = 0;
    rpmNorm = clamp(syntheticLoad * 0.55 + tracker.speed.slow * 0.25);
    engineFundamentalHz =
      profile.voice.baseFrequency *
      (1 + powCurve(syntheticLoad, 0.75) * 1.5 + powCurve(tracker.speed.slow, 0.6) * 0.75);
  } else {
    virtualRpm = 600 + speedKmh * 18 + syntheticLoad * 900;
    rpmNorm = clamp(syntheticLoad * 0.65 + state.load * 0.35);
    engineFundamentalHz =
      profile.voice.baseFrequency *
      (1 +
        powCurve(tracker.speed.slow, 0.7) * 1.8 +
        syntheticLoad * 0.55 +
        tracker.throttle.fast * 0.25);
  }

  const gearCount = tx?.gearRatios.length ?? 1;
  const gearNorm =
    state.gear > 0 ? clamp((state.gear - 1) / Math.max(1, gearCount - 1)) : speedNorm;

  const bodyLevel =
    family === "environmental" || family === "musical"
      ? clamp(tracker.speed.slow * 0.55 + syntheticLoad * 0.35 + tracker.throttle.fast * 0.2)
      : family === "designed"
        ? clamp(syntheticLoad * 0.5 + tracker.speed.slow * 0.3 + tracker.throttle.fast * 0.22)
        : usePowertrain && pt
          ? clamp(
              tracker.speed.slow * 0.55 +
                tracker.throttle.fast * 0.35 +
                rpmNorm * 0.35 -
                state.regen * 0.2,
            )
          : profile.drivetrainMode === "continuous"
            ? clamp(
                tracker.speed.slow * 0.32 +
                  syntheticLoad * 0.42 +
                  tracker.throttle.fast * 0.28 -
                  state.regen * 0.18,
              )
            : clamp(
                tracker.speed.slow * 0.55 +
                  tracker.throttle.fast * 0.35 +
                  rpmNorm * 0.35 -
                  state.regen * 0.2,
              );

  const pitchTau =
    profile.id === "cruise-ship" || profile.id === "space-ship"
      ? 0.55
      : profile.id === "private-jet"
        ? 0.28
        : profile.id === "wiesn-tractor"
          ? 0.65
          : profile.id === "dragon" || profile.id === "thunder-beast"
            ? 0.32
            : profile.id === "neon-drive"
              ? 0.16
              : family === "environmental" || family === "musical"
                ? 0.2
                : usePowertrain && drivetrain
                  ? drivetrain.motion.pitchTauBase +
                    tracker.shiftDip * drivetrain.motion.pitchTauShiftScale +
                    (pt?.revMatchActive ? drivetrain.motion.pitchTauRevMatchExtra : 0)
                  : profile.drivetrainMode === "virtual-transmission" && drivetrain
                    ? drivetrain.motion.pitchTauBase +
                      tracker.shiftDip * drivetrain.motion.pitchTauShiftScale
                    : 0.12 + (1 - tracker.accel.fast) * 0.1;

  const dynamicLayers =
    usePowertrain && pt && drivetrain ? computeDynamicLayerWeights(pt, drivetrain) : null;

  return {
    dt,
    speedMps: state.speed,
    speedKmh,
    speedSlow: tracker.speed.slow,
    speedNorm,
    accelMps2: state.acceleration,
    accelFast: state.acceleration < 0 ? tracker.accel.fast * 0.35 : tracker.accel.fast,
    throttle: state.throttle,
    throttleFast: tracker.throttle.fast,
    regen: state.regen,
    jerk: jerkNorm,
    virtualRpm,
    rpmNorm,
    gear: state.gear,
    gearNorm,
    isShifting,
    shiftDip: tracker.shiftDip,
    shiftProgress: pt?.shiftProgress ?? 0,
    shiftDirection: pt?.shiftDirection ?? null,
    revMatchActive: pt?.revMatchActive ?? false,
    revMatchProgress: pt?.revMatchProgress ?? 0,
    overrun: pt?.overrun ?? false,
    drivingMode: pt?.drivingMode ?? null,
    dynamicLayers,
    syntheticLoad,
    bodyLevel: Math.max(0.08, bodyLevel),
    engineFundamentalHz: Math.max(18, Math.min(2800, engineFundamentalHz)),
    pitchTau,
    stereoWidth: 0.55 + smoothstep(0.1, 0.8, tracker.speed.slow) * 0.45,
    raw: state,
  };
}
