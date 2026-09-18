import type { DriveEnergyState } from "@/lib/symphony";
import type { WorldMotionState } from "./types";

const ENTER: Record<WorldMotionState, number> = {
  idle: 0.03,
  motion: 0.1,
  build: 0.35,
  high_energy: 0.62,
  coast: 0.25,
  regen: 0.2,
  stop: 0.02,
};

/**
 * Map Drive Energy → World motion fiction state with hysteresis.
 */
export function deriveWorldState(
  energy: DriveEnergyState,
  prev: WorldMotionState,
  speedMps: number,
): WorldMotionState {
  if (speedMps < 0.4 && energy.energy < 0.08) {
    return energy.energy < 0.04 ? "idle" : "stop";
  }
  if (energy.regenIntensity > 0.35 && energy.driverDemand < 0.25) return "regen";
  if (energy.movementState === "decelerating" && energy.driverDemand < 0.2) return "coast";
  if (energy.movementState === "peak" || energy.energy > ENTER.high_energy) return "high_energy";
  if (
    energy.movementState === "building" ||
    energy.movementState === "energetic" ||
    energy.tension > 0.55
  ) {
    return "build";
  }
  if (energy.energy > ENTER.motion || speedMps > 2) return "motion";

  // Hysteresis: don't flap back to idle immediately
  if (prev === "motion" && energy.energy > 0.06) return "motion";
  return speedMps < 0.3 ? "idle" : "stop";
}
