import type { VehicleMotionState } from "@/lib/motion/types";
import type { DriveState } from "@/lib/drive/model";
import { DEFAULT_TUNING, type ProfileTuning } from "@/lib/drive/settings";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Map Dynamic Drive powertrain output into the audio-facing DriveState contract. */
export function driveStateFromPowertrain(
  powertrain: VirtualPowertrainState,
  motion: VehicleMotionState,
  previous: DriveState,
  tuning?: ProfileTuning,
  dt = 0.016,
): DriveState {
  const tune = { ...DEFAULT_TUNING, ...(tuning ?? {}) };
  const speed = motion.speedKmh / 3.6;
  const acceleration = motion.accelerationMs2;
  const regen = clamp((motion.decelerationMs2 / 4.2) * tune.regen);
  const jerk = clamp((acceleration - previous.acceleration) / Math.max(0.008, dt) / 30, -1, 1);

  let load = clamp(powertrain.load * tune.response);
  if (powertrain.shifting) {
    const dip =
      powertrain.shiftDirection === "up"
        ? 0.28 * (1 - (powertrain.shiftProgress ?? 0))
        : 0.12 * (1 - (powertrain.shiftProgress ?? 0));
    load *= 1 - dip;
  }

  return {
    speed,
    acceleration,
    throttle: powertrain.throttle,
    regen,
    rpm: powertrain.rpm,
    gear: powertrain.gear,
    load,
    timestamp: powertrain.timestamp || performance.now(),
    jerk,
    isShifting: powertrain.shifting,
    speedNormalized: clamp(motion.speedKmh / 160),
    accelerationNormalized: clamp(Math.abs(acceleration) / 4.5),
    powertrain,
    powertrainBackend: "dynamic",
  };
}
