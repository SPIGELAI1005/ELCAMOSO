import type { SoundProfile } from "@/lib/sound/profiles";
import type { PowertrainBackend, VirtualPowertrainState } from "@/lib/powertrain/types";
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
  /** Dynamic Drive powertrain overlay - present when Dynamic Drive mode is active */
  powertrain?: VirtualPowertrainState;
  /**
   * Dev/diagnostics only: which transmission backend produced this frame.
   * Never surface in consumer UI - use to avoid mistaking Legacy for Dynamic Drive.
   */
  powertrainBackend?: PowertrainBackend;
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
  powertrainBackend: "legacy",
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Demand breakpoints shared with the powertrain shift map (see shift-map.ts). */
const LEGACY_DEMAND_BREAKPOINTS = [0, 0.15, 0.35, 0.6, 0.8, 1] as const;

function sampleDemandTable(table: number[], demand: number): number {
  const d = clamp(demand);
  for (let i = 0; i < LEGACY_DEMAND_BREAKPOINTS.length - 1 && i < table.length - 1; i++) {
    const a = LEGACY_DEMAND_BREAKPOINTS[i]!;
    const b = LEGACY_DEMAND_BREAKPOINTS[i + 1]!;
    if (d <= b) {
      const t = (d - a) / Math.max(0.001, b - a);
      return table[i]! + (table[i + 1]! - table[i]!) * t;
    }
  }
  return table[table.length - 1]!;
}

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
  // Road speed is not driver demand - only a small road-load term.
  const roadLoad = Math.min(0.12, (speed / 50) * 0.08 + (speed / 70) ** 2 * 0.04);
  const throttleTarget = clamp((Math.max(0, acceleration) / 2.6) * tune.throttle + roadLoad);
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
      powertrainBackend: "legacy",
    };
  }

  const t = profile.transmission!;
  const kmh = speed * 3.6;
  const topGear = t.gearRatios.length;
  const span = t.redlineRpm - t.idleRpm;
  // Slopes are physical rpm-per-km/h (see personalityLegacyTransmission): rpm = kmh × slope,
  // floored at idle because a slipping clutch / converter never lets the engine stall.
  const rpmInGear = (candidate: number) =>
    Math.max(t.idleRpm, kmh * t.gearRatios[candidate - 1]!);
  // Demand-dependent shift points. Personalities provide the same demand → RPM curve the
  // Dynamic Drive simulator uses; otherwise a generic curve (relaxed ≈ 38 % of the rev span,
  // flat out ≈ 92 %). Downshift line sits below the post-upshift drop so the box does not hunt.
  const upshiftRpm = t.upshiftRpmByDemand
    ? sampleDemandTable(t.upshiftRpmByDemand, throttle)
    : t.idleRpm + span * clamp(0.38 + throttle * 0.54, 0.38, 0.92);
  const downshiftRpm = Math.min(
    upshiftRpm - span * 0.12,
    t.downshiftRpm ?? t.idleRpm + span * 0.17,
  );
  const kickdownWanted = throttle > 0.78;

  let gear = previous.gear >= 1 ? Math.min(previous.gear, topGear) : 1;
  while (gear < topGear && rpmInGear(gear) > upshiftRpm) gear += 1;
  while (gear > 1) {
    const lowerRpm = rpmInGear(gear - 1);
    const coastDown = rpmInGear(gear) < downshiftRpm && lowerRpm < upshiftRpm - span * 0.08;
    const kickDown =
      kickdownWanted && rpmInGear(gear) < t.idleRpm + span * 0.5 && lowerRpm < t.redlineRpm * 0.8;
    if (coastDown || kickDown) gear -= 1;
    else break;
  }
  // Mechanical RPM from the physical slope - launch slip only below walking pace.
  const launchSlip = kmh < 8 ? throttle * 450 : throttle * 40;
  const targetRpm = Math.min(t.redlineRpm, Math.max(t.idleRpm * 0.9, rpmInGear(gear) + launchSlip));
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
    powertrainBackend: "legacy",
  };
}
