/** Worlds - reactive sonic fiction around motion. */

export type WorldMotionState =
  "idle" | "motion" | "build" | "high_energy" | "coast" | "regen" | "stop";

export type WorldLayerId =
  | "reactor"
  | "energyField"
  | "cabin"
  | "thruster"
  | "windEnergy"
  | "warp"
  | "regenTone"
  | "digitalPulse"
  | "synthBody"
  | "cityAmbience"
  | "accelShimmer"
  | "regenReversal"
  | "speedAmbience"
  | "wind"
  | "thunder"
  | "airPressure"
  | "rain"
  | "cinematicTone";

export type WorldLayerKind = "drone" | "pulse" | "noise" | "shimmer" | "impact";

export interface WorldLayerSpec {
  id: WorldLayerId;
  label: string;
  kind: WorldLayerKind;
  /** Base gain when fully active */
  level: number;
  /** Centre tone Hz */
  tone: number;
  /**
   * Optional quiet low partial (Hz, typically 45–55) mixed into a drone so the
   * world keeps some felt body below 60 Hz while 70–150 Hz carries the bass.
   */
  subHz?: number;
  /** Sub partial level relative to the drone (0..1, default 0.35). */
  subLevel?: number;
}

export interface WorldStateGains {
  state: WorldMotionState;
  gains: Partial<Record<WorldLayerId, number>>;
}

export interface WorldPack {
  id: string;
  name: string;
  tagline: string;
  character: string;
  packGain: number;
  layers: WorldLayerSpec[];
  stateRules: WorldStateGains[];
  /** Thunder / impact cooldown seconds */
  eventCooldownSec: number;
  licensing: {
    source: "procedural_placeholder";
    notes: string;
    version: string;
  };
}

export interface WorldDiagnostics {
  packId: string | null;
  worldState: WorldMotionState;
  energy: number;
  activeLayers: WorldLayerId[];
  pendingEvents: number;
  transitionGain: number;
}
