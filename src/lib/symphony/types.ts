/** Drive Symphony V1 - types */

export type MovementState =
  "stopped" | "calm" | "cruise" | "building" | "energetic" | "peak" | "decelerating";

export type StemId =
  | "atmosphere"
  | "drumsLow"
  | "drumsHigh"
  | "bass"
  | "rhythm"
  | "lead"
  | "strings"
  | "brass"
  | "piano"
  | "cello"
  | "fx";

export type QuantizeGrid = "beat" | "halfBar" | "bar" | "twoBars";

export type SymphonySemanticEvent =
  | "drive_started"
  | "movement_started"
  | "energy_rise"
  | "energy_fall"
  | "strong_acceleration"
  | "lift"
  | "regen_started"
  | "upshift"
  | "downshift"
  | "kickdown"
  | "cruise_enter"
  | "cruise_exit"
  | "vehicle_stopped";

export interface DriveEnergyWeights {
  /** Driver demand / throttle contribution */
  demand: number;
  /** |acceleration| contribution */
  accel: number;
  /** Speed context (diminishing returns) */
  speed: number;
  /** Engine load if present */
  load: number;
  /** Regen pulls energy down */
  regen: number;
}

export interface DriveEnergyState {
  /** Primary 0..1 musical intensity */
  energy: number;
  smoothness: number;
  momentum: number;
  tension: number;
  regenIntensity: number;
  driverDemand: number;
  movementState: MovementState;
}

export interface MusicClockConfig {
  bpm: number;
  /** Beats per bar (usually 4) */
  beatsPerBar: number;
  barsPerLoop: number;
}

export interface MusicClockSnapshot {
  bpm: number;
  beatsPerBar: number;
  barsPerLoop: number;
  /** Seconds per beat */
  beatDuration: number;
  /** Seconds per bar */
  barDuration: number;
  /** Loop length in seconds */
  loopDuration: number;
  /** Current beat index within bar (0-based) */
  beat: number;
  /** Current bar index within loop (0-based) */
  bar: number;
  /** Absolute beat count since start */
  absoluteBeat: number;
  /** Phase 0..1 within current beat */
  beatPhase: number;
  audioTime: number;
}

export interface StemGainTargets {
  [stem: string]: number;
}

export interface SymphonyPackStemDef {
  id: StemId;
  /** Display label */
  label: string;
  /** Relative path under /audio/symphony/{packId}/ - empty = procedural */
  assetPath?: string;
  /** Procedural character when no asset */
  procedural: "pad" | "pulse" | "bass" | "noise" | "bright" | "warm" | "impact";
  /** Per-asset provenance and technical analysis. Required even for development assets. */
  manifest: {
    assetId: string;
    variation: string;
    version: string;
    copyrightOwner: string;
    license: string;
    source: "procedural_placeholder" | "original" | "commissioned" | "licensed";
    commercialUseStatus: "approved" | "pending" | "development_only" | "rejected";
    sampleRate: number | null;
    durationSeconds: number | null;
    peakDb: number | null;
    rmsDb: number | null;
  };
}

export interface IntensityLayerRule {
  movementState: MovementState;
  /** Stem id → target gain 0..1 */
  gains: Partial<Record<StemId, number>>;
}

export interface SymphonySpeedGate {
  /** Speed where the layer begins to fade in (km/h). */
  inKmh: number;
  /** Speed where the layer reaches maxGain (km/h). */
  fullKmh: number;
  maxGain?: number;
  /** When decelerating, this layer is reduced first. */
  stripOnDecel?: boolean;
}

export interface SymphonyOneShotDef {
  id: string;
  assetPath: string;
  triggers: readonly SymphonySemanticEvent[];
  /** Only one shot from the same group fires per event (variants rotate). */
  group?: string;
  gain?: number;
  cooldownSeconds?: number;
}

export interface SymphonyPack {
  id: string;
  name: string;
  tagline: string;
  bpm: number;
  key: string;
  beatsPerBar: number;
  barsPerLoop: number;
  stems: readonly SymphonyPackStemDef[];
  intensityRules: readonly IntensityLayerRule[];
  /** Pack loudness scale into cabin (keep headroom) */
  packGain: number;
  /**
   * Optional one-shot intro played once on start, after which looping stems begin.
   * Duration must match the decoded intro buffer.
   */
  intro?: {
    assetPath: string;
    durationSeconds: number;
  };
  /**
   * Tesla-oriented low-shelf gain in dB applied in the stem player (default -8).
   * Set to 0 to preserve the source mix (no shelf).
   */
  lowShelfGain?: number;
  /** When true (default if an intro is present), play the intro once on start. */
  playIntroOnStart?: boolean;
  /**
   * Optional speed-based layer gates. When present, SymphonySynth uses these
   * (plus deceleration / peak) instead of jumping straight to intensityRules.
   * Other packs omit this and keep the existing movement-state table.
   */
  speedGates?: Partial<Record<StemId, SymphonySpeedGate>>;
  /** One-shot fills, chants and risers, triggered by semantic drive events. */
  oneShots?: readonly SymphonyOneShotDef[];
  /** Stem-gain setTarget time constant in seconds (default 0.08). */
  gainTauSeconds?: number;
  licensing: {
    source: "procedural_placeholder" | "original" | "commissioned" | "licensed";
    notes: string;
    version: string;
  };
}

export interface SymphonyDiagnostics {
  packId: string | null;
  bpm: number;
  bar: number;
  beat: number;
  energy: number;
  movementState: MovementState;
  activeStems: StemId[];
  nextTransitionAt: number | null;
  pendingEvents: number;
  bufferReady: boolean;
  seed: number;
  lateEvents: number;
  lookaheadSec: number;
}

export interface SymphonyEnergyConfig {
  weights: DriveEnergyWeights;
  /** EMA time constants (seconds) */
  energyTau: number;
  momentumTau: number;
  smoothnessTau: number;
  tensionTau: number;
}
