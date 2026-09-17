import type { VehicleMotionState } from "@/lib/motion/types";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";
import {
  createDriverDemandState,
  updateDriverDemand,
  type DriverDemandState,
} from "@/lib/powertrain/driver-demand";

export type ThrottleModelState = DriverDemandState;

export function createThrottleModelState(): ThrottleModelState {
  return createDriverDemandState();
}

export interface ThrottleModelInput {
  motion: VehicleMotionState;
  profile: PowertrainProfile;
  /** Optional direct pedal from simulator (0..1). */
  directThrottle?: number;
  /** Optional vehicle-telemetry pedal (highest priority when set). */
  pedalPosition?: number;
  /** Optional braking demand (0..1) reduces throttle target. */
  braking?: number;
  rpmNormalized: number;
  dt: number;
  state: ThrottleModelState;
}

export interface ThrottleModelResult {
  /** Driver demand (accelerator intention). */
  throttle: number;
  /** Engine load (power needed). */
  load: number;
  driverDemand: number;
  engineLoad: number;
  state: ThrottleModelState;
}

/** Attack/release filtered driver demand and separate engine load. */
export function updateThrottleModel(input: ThrottleModelInput): ThrottleModelResult {
  const result = updateDriverDemand({
    motion: input.motion,
    profile: input.profile,
    rpmNormalized: input.rpmNormalized,
    dt: input.dt,
    state: input.state,
    ...(input.pedalPosition !== undefined ? { pedalPosition: input.pedalPosition } : {}),
    ...(input.directThrottle !== undefined ? { directThrottle: input.directThrottle } : {}),
    ...(input.braking !== undefined ? { braking: input.braking } : {}),
  });

  return {
    throttle: result.driverDemand,
    load: result.engineLoad,
    driverDemand: result.driverDemand,
    engineLoad: result.engineLoad,
    state: result.state,
  };
}
