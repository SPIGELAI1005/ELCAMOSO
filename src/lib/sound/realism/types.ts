import type { DriveState } from "@/lib/drive/model";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import type { DynamicLayerWeights } from "@/lib/sound/dynamic-drive/types";

/**
 * Normalized motion controls every improved profile consumes.
 * FAST fields track throttle/accel/jerk; SLOW fields track speed/ambient load.
 */
export interface MotionFrame {
  /** seconds since last update */
  dt: number;
  speedMps: number;
  speedKmh: number;
  /** 0..1 vs ~160 km/h, slow-smoothed */
  speedSlow: number;
  /** 0..1 vs ~160 km/h, raw */
  speedNorm: number;
  accelMps2: number;
  /** 0..1 clipped acceleration magnitude, fast */
  accelFast: number;
  throttle: number;
  throttleFast: number;
  regen: number;
  jerk: number;
  virtualRpm: number;
  rpmNorm: number;
  gear: number;
  /** 0..1 across gear box */
  gearNorm: number;
  isShifting: boolean;
  /** 0..1 torque dip during shift */
  shiftDip: number;
  /** Dynamic Drive shift progress 0..1 */
  shiftProgress: number;
  shiftDirection: "up" | "down" | null;
  revMatchActive: boolean;
  revMatchProgress: number;
  overrun: boolean;
  drivingMode: VirtualPowertrainState["drivingMode"] | null;
  /** Crossfade weights when Dynamic Drive audio is active */
  dynamicLayers: DynamicLayerWeights | null;
  /** overall body energy */
  bodyLevel: number;
  /** 0..1 driver intent for continuous profiles (accel/throttle vs cruise at same speed) */
  syntheticLoad: number;
  /** Hz for combustion/harmonic fundamentals */
  engineFundamentalHz: number;
  pitchTau: number;
  stereoWidth: number;
  raw: DriveState;
}

export type SynthesisMode = "original" | "improved";

export interface ProfileStrategy {
  id: string;
  build: (
    ctx: BaseAudioContext,
    buses: StrategyBuses,
    profile: SoundProfile,
  ) => import("@/lib/sound/dsp/layers").LayerHandle[];
}

export interface StrategyBuses {
  body: AudioNode;
  accents: AudioNode;
  beds: AudioNode;
  profile: AudioNode;
}

export interface LayerDebugInfo {
  id: string;
  muted: boolean;
  triggerable?: boolean;
}

export type { DynamicLayerDebugInfo } from "@/lib/sound/dynamic-drive/types";
