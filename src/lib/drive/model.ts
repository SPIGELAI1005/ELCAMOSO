import type { SoundProfile } from "@/lib/sound/profiles";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";
import { DEFAULT_TUNING, type ProfileTuning } from "@/lib/drive/settings";
import { DEFAULT_SHIFT_FEEL, type ShiftFeel } from "@/lib/drive/types-extra";

/** Common telemetry every sound strategy consumes. */
export interface DriveState {
  /** metres per second */
  speed: number;
  /** metres per second squared, positive = accelerating */
  acceleration: number;
  /** 0..1 virtual throttle demand */
  throttle: number;
  /** 0..1 regeneration / deceleration demand */
  regen: number;
  /** virtual engine speed, only meaningful for virtual-transmission profiles */
  rpm: number;
  /** 1-based virtual gear, 0 for continuous profiles */
  gear: number;
  /** 0..1 overall sound intensity derived from the above */
  load: number;
  timestamp: number;
  /** rate of change of acceleration, normalised roughly to ±1 */
  jerk: number;
  /** true while a virtual gear change is in progress */
  isShifting: boolean;
  /** Dynamic Drive powertrain overlay — present when Dynamic Drive mode is active */
  powertrain?: VirtualPowertrainState;
  /** 0..1 speed vs ~160 km/h */
  speedNormalized: number;
  /** 0..1 |acceleration| vs ~4.5 m/s² */
  accelerationNormalized: number;
}

export const IDLE_STATE: DriveState = {
  speed: 0,
  acceleration: 0,
  throttle: 0,
  regen: 0,
  rpm: 0,
  gear: 0,
  load: 0,
  timestamp: 0,
  jerk: 0,
  isShifting: false,
  speedNormalized: 0,
  accelerationNormalized: 0,
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export interface ModelInput {
  speed: number;
  acceleration: number;
  previous: DriveState;
  profile: SoundProfile;
  dt: number;
  /** per-profile sensitivity multipliers */
  tuning?: ProfileTuning | undefined;
  /** gear-change feel, used only for virtual-transmission profiles */
  shiftFeel?: ShiftFeel | undefined;
}

export function computeDriveState({
  speed,
  acceleration,
  previous,
  profile,
  dt,
  tuning,
  shiftFeel,
}: ModelInput): DriveState {
  const tune = { ...DEFAULT_TUNING, ...(tuning ?? {}) };
  const feel = { ...DEFAULT_SHIFT_FEEL, ...(shiftFeel ?? {}) };
  const throttleTarget = clamp((acceleration / 2.6 + speed / 60) * tune.throttle);
  const regenTarget = clamp((-acceleration / 2.6) * tune.regen);
  const smooth = clamp(dt / 0.28, 0, 1);
  const throttle = previous.throttle + (throttleTarget - previous.throttle) * smooth;
  const regen = previous.regen + (regenTarget - previous.regen) * smooth;

  if (profile.drivetrainMode === "continuous") {
    const load = clamp((speed / 42 + throttle * 0.35 - regen * 0.25) * tune.response);
    const jerk = clamp((acceleration - previous.acceleration) / Math.max(0.008, dt) / 30, -1, 1);
    return {
      speed,
      acceleration,
      throttle,
      regen,
      rpm: 0,
      gear: 0,
      load,
      timestamp: performance.now(),
      jerk,
      isShifting: false,
      speedNormalized: clamp((speed * 3.6) / 160),
      accelerationNormalized: clamp(Math.abs(acceleration) / 4.5),
    };
  }

  const t = profile.transmission!;
  const kmh = speed * 3.6;
  // pick highest gear that keeps rpm under ~85% of redline
  let gear = 1;
  for (let i = 0; i < t.gearRatios.length; i += 1) {
    const rpm = t.idleRpm + kmh * t.gearRatios[i]!;
    if (rpm < t.redlineRpm * 0.85 || i === 0) gear = i + 1;
    if (rpm < t.redlineRpm * 0.85) break;
  }
  const targetRpm = Math.min(
    t.redlineRpm,
    t.idleRpm + kmh * t.gearRatios[gear - 1]! + throttle * 900,
  );
  const shiftWindow = Math.max(0.04, (feel.shiftMs / 1000) * (1.15 - feel.revMatch * 0.5));
  const shift = clamp(dt / (t.shiftSmoothing * (shiftWindow / 0.16)), 0, 1);
  const rpm = previous.rpm + (targetRpm - previous.rpm) * shift;
  const shifting = previous.gear !== 0 && previous.gear !== gear;
  const dip = shifting ? feel.torqueDip : 0;
  const load = clamp(
    ((rpm - t.idleRpm) / (t.redlineRpm - t.idleRpm) + throttle * 0.2) * tune.response * (1 - dip),
  );
  const jerk = clamp((acceleration - previous.acceleration) / Math.max(0.008, dt) / 30, -1, 1);

  return {
    speed,
    acceleration,
    throttle,
    regen,
    rpm,
    gear,
    load,
    timestamp: performance.now(),
    jerk,
    isShifting: shifting,
    speedNormalized: clamp(kmh / 160),
    accelerationNormalized: clamp(Math.abs(acceleration) / 4.5),
  };
}
