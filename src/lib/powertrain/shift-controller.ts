import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import { easePow, rpmAfterGearChange, rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type ShiftDirection = "up" | "down";

/** Mechanical shift phases - normalized progress still drives timing. */
export type ShiftPhase =
  "idle" | "request" | "torque_cut" | "disengage" | "ratio_transition" | "reengage" | "settle";

const PHASE_EDGES: { phase: ShiftPhase; until: number }[] = [
  { phase: "request", until: 0.08 },
  { phase: "torque_cut", until: 0.22 },
  { phase: "disengage", until: 0.36 },
  { phase: "ratio_transition", until: 0.72 },
  { phase: "reengage", until: 0.88 },
  { phase: "settle", until: 1 },
];

export function shiftPhaseFromProgress(progress: number): ShiftPhase {
  const p = clamp(progress, 0, 1);
  for (const edge of PHASE_EDGES) {
    if (p <= edge.until) return edge.phase;
  }
  return "settle";
}

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

export interface ShiftControllerState {
  active: boolean;
  direction: ShiftDirection;
  progress: number;
  phase: ShiftPhase;
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
    phase: "idle",
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
  // Adjacent gears only - multi-step plans are queued by the simulator.
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
    phase: "request",
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

function shiftDurationSec(
  direction: ShiftDirection,
  profile: PowertrainProfile,
  load = 0.5,
): number {
  const s = profile.transmission.shift;
  const baseMs = direction === "up" ? s.upshiftDurationMs : s.downshiftDurationMs;
  // Heavier load slightly lengthens soft automatics; DCT stays quick via aggression.
  const loadStretch = 1 + clamp(load, 0, 1) * 0.12;
  return (baseMs * loadStretch) / 1000 / Math.max(0.5, profile.behavior.shiftAggression);
}

export function tickShift(
  state: ShiftControllerState,
  dt: number,
  profile: PowertrainProfile,
  opts?: { load?: number; speedKmh?: number },
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

  const duration = shiftDurationSec(state.direction, profile, opts?.load ?? 0.5);
  const progress = Math.min(1, state.progress + dt / Math.max(0.04, duration));
  const phase = shiftPhaseFromProgress(progress);
  const tx = profile.transmission;
  let rpm = state.rpmStart;
  let loadMultiplier = 1;

  // Keep ratio target fresh against road speed during the transition.
  const liveTarget =
    opts?.speedKmh != null
      ? state.direction === "up"
        ? upshiftRpmTarget(opts.speedKmh, state.fromGear, state.toGear, state.rpmStart, profile)
        : rpmFromSpeedAndGear(opts.speedKmh, state.toGear, profile)
      : state.rpmTarget;
  const rpmTarget = liveTarget;
  const rpmRevPeak = state.revMatchActive
    ? Math.min(profile.engine.redlineRpm, rpmTarget * (1 + tx.shift.revMatchOvershoot))
    : rpmTarget;

  if (state.direction === "up") {
    // Hold old-gear feel through torque cut / disengage, then transition ratio.
    if (phase === "request" || phase === "torque_cut") {
      rpm = state.rpmStart;
      loadMultiplier = 1 - tx.shift.torqueDipUp * (phase === "torque_cut" ? 0.85 : 0.35);
    } else if (phase === "disengage") {
      rpm = state.rpmStart;
      loadMultiplier = 1 - tx.shift.torqueDipUp;
    } else {
      const spanStart = 0.36;
      const local = clamp((progress - spanStart) / Math.max(0.08, 1 - spanStart), 0, 1);
      const t = easePow(local, tx.rpm.upshiftEasePower);
      rpm = state.rpmStart + (rpmTarget - state.rpmStart) * t;
      loadMultiplier =
        phase === "reengage" || phase === "settle"
          ? 1 - tx.shift.torqueDipUp * (1 - local) * 0.35
          : 1 - tx.shift.torqueDipUp * Math.sin(Math.PI * Math.min(1, local));
    }
  } else if (state.revMatchActive) {
    const flareEnd = tx.shift.revMatchFlareFraction;
    if (progress <= flareEnd) {
      const t = easePow(progress / Math.max(0.08, flareEnd), tx.rpm.downshiftEasePower);
      rpm = state.rpmStart + (rpmRevPeak - state.rpmStart) * t;
      loadMultiplier = 1 - tx.shift.torqueDipDown * 0.7;
    } else {
      const settle = (progress - flareEnd) / Math.max(0.08, 1 - flareEnd);
      const t = easePow(settle, tx.rpm.downshiftEasePower);
      rpm = rpmRevPeak + (rpmTarget - rpmRevPeak) * t;
      loadMultiplier = 1 - tx.shift.torqueDipDown * (1 - settle);
    }
  } else {
    const t = easePow(progress, tx.rpm.downshiftEasePower);
    rpm = state.rpmStart + (rpmTarget - state.rpmStart) * t;
    loadMultiplier = 1 - tx.shift.torqueDipDown * 0.5 * (1 - progress);
  }

  const next: ShiftControllerState = {
    ...state,
    progress,
    phase,
    rpmTarget,
    rpmRevPeak,
    revMatchProgress: state.revMatchActive
      ? Math.min(1, progress / tx.shift.revMatchFlareFraction)
      : 0,
  };

  if (progress >= 1) {
    return {
      state: createShiftControllerState(),
      rpm: rpmTarget,
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
