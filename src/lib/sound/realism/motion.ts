import type { DriveState } from "@/lib/drive/model";
import { clamp, powCurve, smoothstep } from "@/lib/sound/dsp/math";
import {
  createDualSmoother,
  smoothToward,
  type DualSmootherState,
} from "@/lib/sound/dsp/smoother";
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

export function motionFromDrive(
  state: DriveState,
  profile: SoundProfile,
  tracker: MotionTracker,
  audioTime: number,
): MotionFrame {
  const dt =
    tracker.lastTime > 0 ? clamp(audioTime - tracker.lastTime, 0.004, 0.08) : 1 / 60;
  tracker.lastTime = audioTime;
  const family = familyForProfile(profile);

  const speedKmh = state.speed * 3.6;
  const speedNorm = clamp(speedKmh / 160);
  const speedSlowTau =
    family === "environmental" || family === "musical"
      ? 0.4
      : family === "designed"
        ? 0.7
        : 0.55;
  const throttleFastTau =
    family === "physical" ? 0.04 : family === "designed" ? 0.08 : 0.06;
  tracker.speed.fast = smoothToward(tracker.speed.fast, speedNorm, dt, 0.12);
  tracker.speed.slow = smoothToward(tracker.speed.slow, speedNorm, dt, speedSlowTau);

  const accelNorm = clamp(Math.abs(state.acceleration) / 4.5);
  tracker.accel.fast = smoothToward(tracker.accel.fast, accelNorm, dt, 0.05);
  tracker.accel.slow = smoothToward(tracker.accel.slow, accelNorm, dt, 0.35);

  tracker.throttle.fast = smoothToward(tracker.throttle.fast, state.throttle, dt, throttleFastTau);
  tracker.throttle.slow = smoothToward(tracker.throttle.slow, state.throttle, dt, 0.22);

  const jerk = (state.acceleration - tracker.lastAccel) / Math.max(dt, 0.008);
  tracker.lastAccel = state.acceleration;

  const isShifting =
    family === "physical" &&
    profile.drivetrainMode === "virtual-transmission" &&
    tracker.lastGear !== 0 &&
    state.gear !== 0 &&
    tracker.lastGear !== state.gear;
  if (isShifting) tracker.shiftDip = 1;
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
    virtualRpm = Math.max(tx.idleRpm * 0.85, state.rpm || tx.idleRpm);
    rpmNorm = clamp((virtualRpm - tx.idleRpm) / Math.max(1, tx.redlineRpm - tx.idleRpm));
    engineFundamentalHz = (virtualRpm / 60) * (profile.voice.baseFrequency / 26);
  } else if (family === "designed") {
    // Acceleration weights energy more than absolute speed
    virtualRpm = 0;
    rpmNorm = clamp(tracker.accel.fast * 0.65 + tracker.speed.slow * 0.35);
    engineFundamentalHz =
      profile.voice.baseFrequency *
      (1 + powCurve(tracker.accel.fast, 0.8) * 1.4 + powCurve(tracker.speed.slow, 0.6) * 0.9);
  } else {
    virtualRpm = 600 + speedKmh * 18 + state.throttle * 900;
    rpmNorm = clamp(state.load);
    engineFundamentalHz =
      profile.voice.baseFrequency *
      (1 + powCurve(tracker.speed.slow, 0.7) * 2.1 + tracker.throttle.fast * 0.45);
  }

  const gearCount = tx?.gearRatios.length ?? 1;
  const gearNorm = state.gear > 0 ? clamp((state.gear - 1) / Math.max(1, gearCount - 1)) : speedNorm;

  const bodyLevel =
    family === "environmental" || family === "musical"
      ? clamp(tracker.speed.slow * 0.7 + tracker.throttle.fast * 0.35 + tracker.accel.fast * 0.25)
      : family === "designed"
        ? clamp(tracker.accel.fast * 0.55 + tracker.speed.slow * 0.35 + tracker.throttle.fast * 0.25)
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
                : profile.drivetrainMode === "virtual-transmission"
                  ? 0.045 + tracker.shiftDip * 0.08
                  : 0.12 + (1 - tracker.accel.fast) * 0.1;

  return {
    dt,
    speedMps: state.speed,
    speedKmh,
    speedSlow: tracker.speed.slow,
    speedNorm,
    accelMps2: state.acceleration,
    accelFast:
      state.acceleration < 0 ? tracker.accel.fast * 0.35 : tracker.accel.fast,
    throttle: state.throttle,
    throttleFast: tracker.throttle.fast,
    regen: state.regen,
    jerk: clamp(jerk / 30, -1, 1),
    virtualRpm,
    rpmNorm,
    gear: state.gear,
    gearNorm,
    isShifting,
    shiftDip: tracker.shiftDip,
    bodyLevel: Math.max(0.08, bodyLevel),
    engineFundamentalHz: Math.max(18, Math.min(2800, engineFundamentalHz)),
    pitchTau,
    stereoWidth: 0.55 + smoothstep(0.1, 0.8, tracker.speed.slow) * 0.45,
    raw: state,
  };
}
