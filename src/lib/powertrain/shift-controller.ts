import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { easePow, rpmAfterGearChange, rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function upshiftRpmTarget(
  speedKmh: number,
  fromGear: number,
  toGear: number,
  currentRpm: number,
  profile: PowertrainProfile,
): number {
  const change = rpmAfterGearChange(speedKmh, fromGear, toGear, profile);
  if (change.after < change.before * 0.985) return change.after;

  const fromRatio = profile.transmission.gearRatios[fromGear - 1];
  const toRatio = profile.transmission.gearRatios[toGear - 1];
  if (fromRatio == null || toRatio == null) return change.after;

  const ratioDrop = currentRpm * (toRatio / fromRatio);
  return clamp(
    ratioDrop,
    profile.engine.idleRpm * 0.85,
    profile.engine.redlineRpm * profile.transmission.redline.softFraction,
  );
}

export type ShiftDirection = "up" | "down";

export interface ShiftControllerState {
  active: boolean;
  direction: ShiftDirection;
  progress: number;
  fromGear: number;
  toGear: number;
  revMatchActive: boolean;
  revMatchProgress: number;
  rpmStart: number;
  rpmTarget: number;
  rpmRevPeak: number;
}

export function createShiftControllerState(): ShiftControllerState {
  return {
    active: false,
    direction: "up",
    progress: 0,
    fromGear: 0,
    toGear: 0,
    revMatchActive: false,
    revMatchProgress: 0,
    rpmStart: 0,
    rpmTarget: 0,
    rpmRevPeak: 0,
  };
}

export function beginShift(
  state: ShiftControllerState,
  direction: ShiftDirection,
  fromGear: number,
  toGear: number,
  speedKmh: number,
  currentRpm: number,
  profile: PowertrainProfile,
): ShiftControllerState {
  if (Math.abs(toGear - fromGear) !== 1) {
    return createShiftControllerState();
  }

  const ratioTarget = rpmFromSpeedAndGear(speedKmh, toGear, profile);
  const rpmTarget =
    direction === "up"
      ? upshiftRpmTarget(speedKmh, fromGear, toGear, currentRpm, profile)
      : ratioTarget;
  const rpmStart = currentRpm;

  const revEnabled = direction === "down" && profile.transmission.shift.revMatchEnabled;
  const overshoot = profile.transmission.shift.revMatchOvershoot;
  const rpmRevPeak = revEnabled
    ? Math.min(profile.engine.redlineRpm, rpmTarget * (1 + overshoot))
    : rpmTarget;

  return {
    active: true,
    direction,
    progress: 0,
    fromGear,
    toGear,
    revMatchActive: revEnabled,
    revMatchProgress: 0,
    rpmStart,
    rpmTarget,
    rpmRevPeak,
  };
}

export interface ShiftTickResult {
  state: ShiftControllerState;
  rpm: number;
  loadMultiplier: number;
  complete: boolean;
  completedGear: number | null;
  completedDirection: ShiftDirection | null;
}

function shiftDurationSec(direction: ShiftDirection, profile: PowertrainProfile): number {
  const s = profile.transmission.shift;
  const ms = direction === "up" ? s.upshiftDurationMs : s.downshiftDurationMs;
  return ms / 1000 / Math.max(0.5, profile.behavior.shiftAggression);
}

export function tickShift(
  state: ShiftControllerState,
  dt: number,
  profile: PowertrainProfile,
): ShiftTickResult {
  if (!state.active) {
    return {
      state,
      rpm: state.rpmTarget,
      loadMultiplier: 1,
      complete: false,
      completedGear: null,
      completedDirection: null,
    };
  }

  const duration = shiftDurationSec(state.direction, profile);
  const progress = Math.min(1, state.progress + dt / Math.max(0.04, duration));
  const tx = profile.transmission;
  let rpm = state.rpmStart;
  let loadMultiplier = 1;

  if (state.direction === "up") {
    const t = easePow(progress, tx.rpm.upshiftEasePower);
    rpm = state.rpmStart + (state.rpmTarget - state.rpmStart) * t;
    loadMultiplier = 1 - tx.shift.torqueDipUp * Math.sin(Math.PI * Math.min(1, progress * 1.15));
  } else if (state.revMatchActive) {
    const flareEnd = tx.shift.revMatchFlareFraction;
    const revPhase = Math.min(1, progress / Math.max(0.08, flareEnd));
    if (progress <= flareEnd) {
      const t = easePow(revPhase, tx.rpm.downshiftEasePower);
      rpm = state.rpmStart + (state.rpmRevPeak - state.rpmStart) * t;
    } else {
      const settle = (progress - flareEnd) / Math.max(0.08, 1 - flareEnd);
      const t = easePow(settle, tx.rpm.downshiftEasePower);
      rpm = state.rpmRevPeak + (state.rpmTarget - state.rpmRevPeak) * t;
    }
    loadMultiplier = 1 - tx.shift.torqueDipDown * (1 - progress);
  } else {
    const t = easePow(progress, tx.rpm.downshiftEasePower);
    rpm = state.rpmStart + (state.rpmTarget - state.rpmStart) * t;
    loadMultiplier = 1 - tx.shift.torqueDipDown * 0.5 * (1 - progress);
  }

  const next: ShiftControllerState = {
    ...state,
    progress,
    revMatchProgress: state.revMatchActive
      ? Math.min(1, progress / tx.shift.revMatchFlareFraction)
      : 0,
  };

  if (progress >= 1) {
    return {
      state: createShiftControllerState(),
      rpm: state.rpmTarget,
      loadMultiplier: 1,
      complete: true,
      completedGear: state.toGear,
      completedDirection: state.direction,
    };
  }

  return {
    state: next,
    rpm,
    loadMultiplier,
    complete: false,
    completedGear: null,
    completedDirection: null,
  };
}
