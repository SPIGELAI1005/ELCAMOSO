/** High-level driving context for UI and audio routing. */
export type DrivingMode =
  "idle" | "cruise" | "acceleration" | "hard-acceleration" | "deceleration" | "overrun" | "shift";

export type PowertrainBackend = "legacy" | "dynamic" | "gearless";

export type ShiftPhase =
  "idle" | "request" | "torque_cut" | "disengage" | "ratio_transition" | "reengage" | "settle";

/**
 * Authoritative operating-regime state machine (Prompt 03).
 * Independent of React render rate — updated every simulator tick.
 */
export type OperatingRegime = "steady" | "unloading" | "shifting" | "recovering";

/** Speed sample freshness for UI/audio uncertainty (not a GPS accuracy claim). */
export type SpeedFreshness = "live" | "hold" | "decay" | "stale" | "uncertain";

/** Exactly one event per gear transition, with a unique sequence id. */
export interface DrivetrainShiftEvent {
  sequenceId: number;
  atMs: number;
  fromGear: number;
  toGear: number;
  direction: "up" | "down";
  reason: string;
}

/** Continuous virtual powertrain output (independent of React / audio). */
export interface VirtualPowertrainState {
  timestamp: number;

  engineRunning: boolean;

  /**
   * Authoritative road speed (km/h) used by this tick.
   * Missing telemetry must not be coerced to zero upstream.
   */
  speedKmh: number;
  /** Sensor / fusion source label (phone, vehicle-telemetry, simulator, …). */
  speedSource: string;
  speedFreshness: SpeedFreshness;

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
  /**
   * Estimated load proxy for audio/UI (0..1). Not real throttle or torque;
   * steady uphill load cannot be inferred reliably from speed alone.
   */
  estimatedLoad: number;
  /** Simulated normalized boost (0..1); never measured pressure. */
  boost: number;
  /** One-tick release edge after sufficient boost and a genuine load drop. */
  boostRelease: boolean;
  /** @deprecated alias of driverDemand for older consumers */
  throttle: number;
  /** @deprecated alias of engineLoad for older consumers */
  load: number;

  shifting: boolean;
  shiftDirection?: "up" | "down";
  shiftProgress?: number;
  shiftPhase?: ShiftPhase;
  /** Phase-aware combustion/load scale from shift controller (1 = full). */
  shiftLoadMultiplier?: number;
  lastShiftReason?: string;

  /** Regime state machine: steady → unloading → shifting → recovering. */
  operatingRegime: OperatingRegime;
  /** Most recent completed/begun shift (persists). */
  lastShiftEvent: DrivetrainShiftEvent | null;
  /** Set only on the tick a shift begins — use for once-per-transition consumers. */
  shiftEvent: DrivetrainShiftEvent | null;

  revMatchActive: boolean;
  revMatchProgress: number;

  overrun: boolean;

  drivingMode: DrivingMode;

  /** Dev/diagnostics only - never show in consumer UI. */
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
  speedFreshness: SpeedFreshness;
  /** True when a source/tier change was observed recently. */
  sourceChanged: boolean;
  /** Active artistic shift-map preset id. */
  shiftMapPreset: string;
  /** Timestamp-aware acceleration used by load inference, in m/s². */
  accelerationFilteredMs2: number;
  /** Effective sample/tick interval used by the simulator, in milliseconds. */
  effectiveDtMs: number;
}

export const IDLE_POWERTRAIN: VirtualPowertrainState = {
  timestamp: 0,
  engineRunning: false,
  speedKmh: 0,
  speedSource: "simulator",
  speedFreshness: "uncertain",
  rpm: 0,
  mechanicalRpm: 0,
  normalizedRpm: 0,
  gear: 0,
  targetGear: 0,
  queuedTargetGear: 0,
  driverDemand: 0,
  engineLoad: 0,
  estimatedLoad: 0,
  boost: 0,
  boostRelease: false,
  load: 0,
  throttle: 0,
  shifting: false,
  shiftPhase: "idle",
  lastShiftReason: "none",
  operatingRegime: "steady",
  lastShiftEvent: null,
  shiftEvent: null,
  revMatchActive: false,
  revMatchProgress: 0,
  overrun: false,
  drivingMode: "idle",
};
