import type { VehicleMotionState } from "@/lib/motion/types";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Developer simulator controls — not connected to real sensors. */
export interface SimulatorControls {
  speedKmh: number;
  accelerationMs2: number;
  /** Direct pedal 0..1 */
  throttle: number;
  /** Brake demand 0..1 */
  braking: number;
}

export const DEFAULT_SIMULATOR_CONTROLS: SimulatorControls = {
  speedKmh: 0,
  accelerationMs2: 0,
  throttle: 0,
  braking: 0,
};

export interface SimulatorPhysicsOptions {
  /** When true, throttle/braking integrate speed each tick. */
  integrateSpeed: boolean;
  maxAccelMs2: number;
  maxBrakeMs2: number;
}

export const DEFAULT_SIMULATOR_PHYSICS: SimulatorPhysicsOptions = {
  integrateSpeed: true,
  maxAccelMs2: 4.2,
  maxBrakeMs2: 7.5,
};

export interface SimulatorRuntime {
  controls: SimulatorControls;
  physics: SimulatorPhysicsOptions;
  previousSpeedKmh: number;
  accelFilter: number;
}

export function createSimulatorRuntime(
  controls: SimulatorControls = DEFAULT_SIMULATOR_CONTROLS,
  physics: SimulatorPhysicsOptions = DEFAULT_SIMULATOR_PHYSICS,
): SimulatorRuntime {
  return {
    controls: { ...controls },
    physics: { ...physics },
    previousSpeedKmh: controls.speedKmh,
    accelFilter: controls.accelerationMs2,
  };
}

/** Integrate simple longitudinal physics from pedal inputs. */
export function stepSimulatorControls(
  runtime: SimulatorRuntime,
  controls: SimulatorControls,
  dt: number,
): SimulatorControls {
  const next = { ...controls };
  if (!runtime.physics.integrateSpeed) {
    return next;
  }

  const accel =
    controls.throttle * runtime.physics.maxAccelMs2 -
    controls.braking * runtime.physics.maxBrakeMs2;
  const speedMs = controls.speedKmh / 3.6;
  const newMs = Math.max(0, speedMs + accel * dt);
  next.speedKmh = newMs * 3.6;
  next.accelerationMs2 = dt > 0 ? accel : 0;
  return next;
}

/** Map simulator sliders to VehicleMotionState for the powertrain domain. */
export function motionFromSimulator(
  controls: SimulatorControls,
  runtime: SimulatorRuntime,
  timestamp: number,
  dt: number,
): VehicleMotionState {
  const rawAccel = controls.accelerationMs2;
  const alpha = 1 - Math.exp(-Math.max(0.001, dt) / 0.14);
  runtime.accelFilter = runtime.accelFilter + (rawAccel - runtime.accelFilter) * alpha;

  const decel = Math.max(0, -runtime.accelFilter);
  const inferredFromPedal = clamp01(controls.throttle * (1 - controls.braking * 0.85));
  const inferredFromAccel = clamp01(runtime.accelFilter / 3.5);

  return {
    ...IDLE_VEHICLE_MOTION,
    timestamp,
    speedKmh: Math.max(0, controls.speedKmh),
    accelerationMs2: rawAccel,
    accelerationFiltered: runtime.accelFilter,
    decelerationMs2: decel,
    inferredThrottle: clamp01(inferredFromPedal * 0.6 + inferredFromAccel * 0.4),
    motionConfidence: 1,
    primarySource: "simulator",
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    fallbackTier: "decay",
    transitioning: false,
  };
}
