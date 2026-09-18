/**
 * Dynamic Drive - powertrain simulation domain (no audio, no live sensors).
 *
 * Input: VehicleMotionState (or dev simulator controls)
 * Output: VirtualPowertrainState
 */

export type { VehicleMotionState, MotionSample, SensorSource } from "@/lib/motion/types";
export { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";

export type { VirtualPowertrainState, DrivingMode } from "@/lib/powertrain/types";
export { IDLE_POWERTRAIN } from "@/lib/powertrain/types";

export type {
  PowertrainProfile,
  TransmissionProfile,
  UpshiftRpmTable,
  KickdownProfile,
  DownshiftProfile,
  ShiftProfile,
  IdleStopProfile,
  RedlineProfile,
  RpmTrackingProfile,
} from "@/lib/powertrain/types-config";
export { profileIdleRpm } from "@/lib/powertrain/types-config";

export {
  POWERTRAIN_PROFILES,
  getPowertrainProfile,
  listDrivetrainPersonalities,
} from "@/lib/powertrain/profiles";

export {
  rpmFromSpeedAndGear,
  normalizeRpm,
  rpmAfterGearChange,
  rpmAfterUpshift,
  wheelRpmFromSpeedKmh,
} from "@/lib/powertrain/rpm-model";

export {
  selectTargetGear,
  engageGear,
  resolveGearEngagement,
  upshiftRpmForLoad,
  downshiftRpmForGear,
  type GearSelectorContext,
} from "@/lib/powertrain/gear-selector";

export {
  beginShift,
  tickShift,
  createShiftControllerState,
  type ShiftControllerState,
  type ShiftDirection,
  type ShiftTickResult,
} from "@/lib/powertrain/shift-controller";

export {
  updateThrottleModel,
  createThrottleModelState,
  type ThrottleModelState,
  type ThrottleModelInput,
  type ThrottleModelResult,
} from "@/lib/powertrain/throttle-model";

export { updateOverrun, createOverrunState, type OverrunState } from "@/lib/powertrain/overrun";

export {
  PowertrainSimulator,
  idlePowertrainState,
  type PowertrainSimulatorOptions,
  type PowertrainSimulatorInternals,
} from "@/lib/powertrain/simulator";

export { resolveDrivingMode } from "@/lib/powertrain/domain/driving-mode";

export {
  DEFAULT_SIMULATOR_CONTROLS,
  DEFAULT_SIMULATOR_PHYSICS,
  createSimulatorRuntime,
  motionFromSimulator,
  stepSimulatorControls,
  type SimulatorControls,
  type SimulatorRuntime,
  type SimulatorPhysicsOptions,
} from "@/lib/powertrain/dev-simulator";

export {
  PowertrainSimulationSession,
  createSimulationSession,
  type SimulationTickResult,
} from "@/lib/powertrain/domain/simulation-session";

export {
  POWERTRAIN_SCENARIOS,
  runPowertrainScenario,
  validatePowertrainTrace,
  type PowertrainScenario,
  type PowertrainTraceSample,
} from "@/lib/powertrain/scenarios";
