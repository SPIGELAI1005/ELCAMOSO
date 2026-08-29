/** High-level driving context for UI and audio routing. */
export type DrivingMode =
  "idle" | "cruise" | "acceleration" | "hard-acceleration" | "deceleration" | "overrun" | "shift";

/** Continuous virtual powertrain output (independent of React / audio). */
export interface VirtualPowertrainState {
  timestamp: number;

  engineRunning: boolean;

  rpm: number;
  normalizedRpm: number;

  /** 1-based gear; 0 = neutral / not engaged */
  gear: number;
  targetGear: number;

  load: number;
  throttle: number;

  shifting: boolean;
  shiftDirection?: "up" | "down";
  shiftProgress?: number;

  revMatchActive: boolean;
  revMatchProgress: number;

  overrun: boolean;

  drivingMode: DrivingMode;
}

export const IDLE_POWERTRAIN: VirtualPowertrainState = {
  timestamp: 0,
  engineRunning: false,
  rpm: 0,
  normalizedRpm: 0,
  gear: 0,
  targetGear: 0,
  load: 0,
  throttle: 0,
  shifting: false,
  revMatchActive: false,
  revMatchProgress: 0,
  overrun: false,
  drivingMode: "idle",
};
