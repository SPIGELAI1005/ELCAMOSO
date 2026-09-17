export type { VehicleMotionState, MotionSample, SensorSource } from "@/lib/motion/types";
export { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";

export type { VirtualPowertrainState, DrivingMode } from "@/lib/powertrain/types";
export { IDLE_POWERTRAIN } from "@/lib/powertrain/types";

export {
  DRIVETRAIN_PERSONALITY_IDS,
  DRIVETRAIN_PERSONALITIES,
  getDrivetrainPersonality,
  listDrivetrainPersonalities,
  personalityLegacyTransmission,
  personalityToPowertrain,
  type DrivetrainPersonalityConfig,
  type DrivetrainPersonalityId,
  type DrivetrainMotionTuning,
  type TransientAudioConfig,
} from "@/lib/drive/drivetrain-personalities";

export {
  resolveDrivetrain,
  resolvePersonalityId,
  withPersonalityTransmission,
  type ResolvedDrivetrain,
} from "@/lib/drive/drivetrain-resolve";

export { driveStateFromPowertrain } from "@/lib/powertrain/adapters/drive-state";
export {
  powertrainProfileForSound,
  supportsDynamicDrive,
} from "@/lib/powertrain/adapters/profile-map";
export { vehicleMotionFromDrive } from "@/lib/powertrain/adapters/vehicle-motion";

export {
  POWERTRAIN_SCENARIOS,
  getPowertrainScenario,
  runPowertrainScenario,
  validatePowertrainTrace,
  type PowertrainScenario,
  type PowertrainTraceSample,
  type ScenarioRunResult,
  type TraceValidation,
} from "@/lib/powertrain/scenarios";

export type {
  TransmissionProfile,
  PowertrainProfile,
  UpshiftRpmTable,
  KickdownProfile,
  DownshiftProfile,
  ShiftProfile,
  IdleStopProfile,
  RedlineProfile,
  RpmTrackingProfile,
} from "@/lib/powertrain/profiles";
export { POWERTRAIN_PROFILES, getPowertrainProfile } from "@/lib/powertrain/profiles";

export {
  rpmFromSpeedAndGear,
  speedKmhFromRpmAndGear,
  normalizeRpm,
  rpmAfterGearChange,
  rpmAfterUpshift,
  wheelRpmFromSpeedKmh,
  rpmTrackTarget,
  rpmTrackTargetEx,
} from "@/lib/powertrain/rpm-model";

export {
  selectTargetGear,
  selectTargetGearDetailed,
  engageGear,
  resolveGearEngagement,
  upshiftRpmForLoad,
  downshiftRpmForGear,
} from "@/lib/powertrain/gear-selector";
export {
  beginShift,
  tickShift,
  createShiftControllerState,
  shiftPhaseFromProgress,
} from "@/lib/powertrain/shift-controller";
export { updateThrottleModel, createThrottleModelState } from "@/lib/powertrain/throttle-model";
export {
  updateDriverDemand,
  createDriverDemandState,
  roadLoadEstimate,
} from "@/lib/powertrain/driver-demand";
export {
  generateShiftMap,
  resolveShiftMap,
  validateShiftMap,
  roadSpeedForRpmGear,
  rpmForRoadSpeedGear,
  calibrationUpshiftTable,
  scheduleUpshiftRpmForDemand,
  DEMAND_BREAKPOINTS,
} from "@/lib/powertrain/shift-map";
export {
  shouldUseDynamicPowertrain,
  shouldUseDynamicPowertrainFromSessionConfig,
} from "@/lib/powertrain/dynamic-powertrain-gate";
export { reconcileKickdownQueue } from "@/lib/powertrain/kickdown-queue";
export { updateOverrun, createOverrunState } from "@/lib/powertrain/overrun";

export {
  PowertrainSimulator,
  idlePowertrainState,
  type PowertrainSimulatorOptions,
  type PowertrainSimulatorInternals,
} from "@/lib/powertrain/simulator";

export {
  DEFAULT_SIMULATOR_CONTROLS,
  DEFAULT_SIMULATOR_PHYSICS,
  createSimulatorRuntime,
  motionFromSimulator,
  stepSimulatorControls,
  type SimulatorControls,
  type SimulatorRuntime,
} from "@/lib/powertrain/dev-simulator";

export * from "@/lib/powertrain/domain";
