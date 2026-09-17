/** High-level driving context for UI and audio routing. */
export type DrivingMode =
  "idle" | "cruise" | "acceleration" | "hard-acceleration" | "deceleration" | "overrun" | "shift";

export type PowertrainBackend = "legacy" | "dynamic";

export type ShiftPhase =
  "idle" | "request" | "torque_cut" | "disengage" | "ratio_transition" | "reengage" | "settle";

/** Continuous virtual powertrain output (independent of React / audio). */
export interface VirtualPowertrainState {
  timestamp: number;

  engineRunning: boolean;

  rpm: number;
  /** Locked mechanical RPM from speed × ratio (pre-slip / pre-shift animation). */
  mechanicalRpm: number;
  normalizedRpm: number;

  /** 1-based gear; 0 = neutral / not engaged */
  gear: number;
  /** Next adjacent step currently being shifted toward. */
  targetGear: number;
  /** Ultimate desired gear (kickdown may be >1 step away). */
  queuedTargetGear: number;

  /** Accelerator / intention proxy. */
  driverDemand: number;
  /** Virtual power needed at current speed/accel. */
  engineLoad: number;
  /** @deprecated alias of driverDemand for older consumers */
  throttle: number;
  /** @deprecated alias of engineLoad for older consumers */
  load: number;

  shifting: boolean;
  shiftDirection?: "up" | "down";
  shiftProgress?: number;
  shiftPhase?: ShiftPhase;
  lastShiftReason?: string;

  revMatchActive: boolean;
  revMatchProgress: number;

  overrun: boolean;

  drivingMode: DrivingMode;

  /** Dev/diagnostics only — never show in consumer UI. */
  diagnostics?: PowertrainRuntimeDiagnostics;
}

export interface PowertrainRuntimeDiagnostics {
  powertrainBackend: PowertrainBackend;
  /** Responsive fused speed for UI (no extra powertrain lag). */
  displaySpeedKmh: number;
  /** Lightly filtered speed for mechanical RPM. */
  mechanicalSpeedKmh: number;
  /** @deprecated alias of displaySpeedKmh */
  rawSpeedKmh: number;
  /** Heavily filtered speed for gear selection / hysteresis. */
  shiftDecisionSpeedKmh: number;
  braking: number;
  motionSource: string;
  fallbackTier: string;
}

export const IDLE_POWERTRAIN: VirtualPowertrainState = {
  timestamp: 0,
  engineRunning: false,
  rpm: 0,
  mechanicalRpm: 0,
  normalizedRpm: 0,
  gear: 0,
  targetGear: 0,
  queuedTargetGear: 0,
  driverDemand: 0,
  engineLoad: 0,
  load: 0,
  throttle: 0,
  shifting: false,
  shiftPhase: "idle",
  lastShiftReason: "none",
  revMatchActive: false,
  revMatchProgress: 0,
  overrun: false,
  drivingMode: "idle",
};
