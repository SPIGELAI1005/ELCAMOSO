import type { DrivetrainMode, MotionModel } from "@/lib/sound/profiles";
import type { ProfileFamily } from "@/lib/sound/realism/families";
import type {
  AspirationKind,
  AudioLayerRole,
  LoadDriver,
  PitchDriver,
  ProfilePhysics,
  ProfileUpgradeStatus,
} from "@/lib/sound/profile-experience-config";

/**
 * Typed acoustic recipe metadata keyed by Sound Profile id.
 * Does not replace SoundProfile. Must not be parsed from Markdown at runtime.
 *
 * `family` mirrors familyForProfile() and is the only family field that may
 * later drive routing. `packageFamily` is documentation/design intent only.
 */
export interface AcousticFamilyMismatch {
  runtimeFamily: ProfileFamily;
  packageFamily: ProfileFamily;
  /** Why runtime was preserved (audible routing impact). */
  deferredReason: string;
  /** Docs pointer for the investigation. */
  documentation: string;
}

export interface AcousticLayerPlan {
  roles: readonly AudioLayerRole[];
}

export interface AcousticControlMap {
  pitchDriver: PitchDriver;
  loadDriver: LoadDriver;
}

export interface AcousticPhaseMix {
  idleCharacter: number;
  pullAwayTexture: number;
  accelerationTexture: number;
  cruiseIntrusiveScale: number;
  releaseCharacter: number;
  regenCharacter: number;
  stopTail: number;
}

/**
 * RPM / load / regime metadata mirrored from the catalog and experience config.
 * Descriptive only in Prompt 2 — does not drive PowertrainSimulator or synth.
 */
export interface AcousticRegimeModel {
  drivetrainMode: DrivetrainMode;
  motionModel: MotionModel | null;
  drivetrainPersonalityId: string | null;
  /** Named driving phases represented by dsp.phases scalars. */
  phaseKeys: readonly (keyof AcousticPhaseMix)[];
  /** True when aspirationDynamics describe turbo/supercharger spool. */
  hasForcedInductionDynamics: boolean;
  /** Realism V2 combustion eligibility (procedural; samples optional). */
  realismV2Combustion: boolean;
}

export interface AcousticAspirationDynamics {
  attackSeconds: number;
  decaySeconds: number;
  minimumReleaseState: number;
  speedRatio: number;
}

export interface AcousticDspLimits {
  transitionTauSeconds: number;
  aspiration: AspirationKind;
  aspirationDynamics: AcousticAspirationDynamics;
  phases: AcousticPhaseMix;
}

export interface AcousticEventGates {
  variationDepth: number;
  minEventCooldownSeconds: number;
  maxEventVoices: number;
}

export interface AcousticLoudnessLimits {
  /** Portfolio trim from loudnessForProfile (missing → 1). */
  profileTrim: number;
  /** Product master ceiling (SoundEngine.MAX_GAIN). Metadata only here. */
  maxGainCeiling: number;
}

export interface AcousticSampleBankHook {
  /** Present when Realism V2 / pilot wiring may attach a bank. */
  personalityHint: string | null;
  /** Always false until approved manifests ship assets. */
  approvedAssetsPresent: boolean;
}

export interface AcousticAcceptanceMeta {
  physics: ProfilePhysics;
  status: ProfileUpgradeStatus;
}

/** Renderer kind for recipe routing — metadata only until a later flag enables a new path. */
export type AcousticRendererKind =
  | "combustion-hybrid-v2"
  | "combustion-improved"
  | "electric-designed"
  | "creature-cinematic"
  | "environmental-ambient"
  | "musical"
  | "physical-machine"
  | "symphony"
  | "world"
  | "fusion";

export type AcousticCapability =
  | "virtual-transmission"
  | "forced-induction"
  | "regen-identity"
  | "combustion-events"
  | "combustion-shift-accents"
  | "sample-bank"
  | "continuous-motion"
  | "musical-grammar";

/**
 * Cylinder / cycle geometry. Units: RPM for idle/max; degrees for cycleDegrees;
 * harmonic weights dimensionless 0..1. Use stroke "none" for gearless / non-combustion.
 */
export interface AcousticCycleGeometry {
  /** Cylinder count; 0 when stroke is none. */
  cylinders: number;
  stroke: "four-stroke" | "two-stroke" | "none";
  /** 720 for four-stroke, 360 for two-stroke, 0 for none. */
  cycleDegrees: number;
  bankRouting: "inline" | "v90" | "v60" | "flat" | "single" | "none";
  architecture: string | null;
  /** Idle reference (RPM). Real RPM, not normalized 0..1. */
  idleRpm: number;
  /** Soft redline / max reference (RPM). Real RPM, not normalized 0..1. */
  maxRpm: number;
  /** Order weights for harmonic partials (dimensionless 0..1). */
  harmonicOrderWeights: number[];
  /** Bounded cycle-to-cycle variation 0..1. */
  cycleVariation: number;
}

export type AcousticRecipeLayerRole =
  | "exhaust-body"
  | "intake"
  | "mechanical"
  | "induction"
  | "event"
  | "core"
  | "motor"
  | "regen"
  | "environment"
  | "music";

export interface AcousticLayerRegimeGains {
  /** Relative gain scalars (dimensionless), typically 0..2. */
  idle: number;
  cruise: number;
  onLoad: number;
  overrun: number;
}

export interface AcousticLayerRecipe {
  role: AcousticRecipeLayerRole;
  gains: AcousticLayerRegimeGains;
  /** Low-pass corner (Hz); null = not specified. */
  filterLowpassHz: number | null;
  /** High-pass corner (Hz); null = not specified. */
  filterHighpassHz: number | null;
  /** Mild saturation amount 0..1. */
  saturation: number;
  /** How strongly real RPM changes timbre 0..1 (not normalized-RPM confusion). */
  rpmTimbreResponse: number;
  /** How strongly estimated load changes timbre 0..1. */
  loadTimbreResponse: number;
}

export interface AcousticVirtualTransmissionRecipe {
  enabled: boolean;
  /** Gear ratios (dimensionless). Empty when disabled. */
  gearRatios: number[];
  /** Final drive (dimensionless). */
  finalDrive: number;
  /** Wheel circumference (m). */
  wheelCircumferenceM: number;
  shiftMode: "automatic" | "none";
  /**
   * Gentle-demand upshift road-speed thresholds (km/h), gears 1→2 … when available.
   * Artistic / simulated — not measured vehicle telemetry.
   */
  upshiftThresholdsKmh: number[];
  /** Companion downshift thresholds (km/h); may be empty when map unavailable. */
  downshiftThresholdsKmh: number[];
  /** Speed hysteresis (km/h). */
  hysteresisKmh: number;
  /** Torque-cut envelope (ms). */
  torqueCutMs: number;
  /** Recovery / re-engage envelope (ms). */
  recoveryMs: number;
  /** Downshift blip intensity 0..1. */
  downshiftBlip: number;
  /** Minimum gear dwell (s). */
  minGearDwellSeconds: number;
  /** Shift-related event cooldown (s). */
  eventCooldownSeconds: number;
  /**
   * When false, recipes must not inherit combustion pops / RPM clacks.
   * Gearless / continuous profiles set this false explicitly.
   */
  allowCombustionShiftAccents: boolean;
}

export interface AcousticSampleBankRecipe {
  personalityHint: string | null;
  approvedAssetsPresent: boolean;
  /** Source RPM anchors for bank entries (RPM); empty when none approved. */
  sourceRpmAnchors: number[];
  /** Load regime tags present in the bank. */
  loadRegimes: string[];
  /** Loop boundaries in seconds when known. */
  loopBoundariesSeconds: { start: number; end: number }[];
  /** Permissible playback-rate stretch clamp (dimensionless). */
  permissibleStretch: { min: number; max: number };
  /** Provenance note — never invents asset rights. */
  provenance: string;
  /** Procedural fallback always remains available. */
  proceduralFallback: true;
}

export interface AcousticHeadroomRecipe {
  /** Loudness trim (dimensionless). */
  profileTrim: number;
  /** Master ceiling 0..0.85. */
  maxGainCeiling: number;
  /** User volume control range (dimensionless). */
  userVolumeMin: number;
  userVolumeMax: number;
  /** Anti-harshness high-shelf corner (Hz); null = none. */
  antiHarshnessHighShelfHz: number | null;
  /** Anti-harshness shelf gain (dB), typically ≤ 0. */
  antiHarshnessGainDb: number;
}

/**
 * Listening verdicts stay out of runtime configuration.
 * Never read by SoundEngine until an explicit acceptance workflow says otherwise.
 */
export interface AcousticListeningAcceptance {
  listeningVerdict: "pending" | "approved" | "rejected";
  notes: string;
}

export interface AcousticRecipeInheritance {
  /** Family / foundation defaults id used as the base. */
  familyDefaultsId: string;
  /** Dot-paths of fields overridden vs that foundation. */
  overrides: string[];
}

/**
 * Distinct per-ID acoustic recipe (Prompt 02). Metadata only — audible output
 * stays on existing strategies until a later feature flag enables a new renderer.
 */
export interface AcousticRecipe {
  rendererKind: AcousticRendererKind;
  capabilities: AcousticCapability[];
  inheritance: AcousticRecipeInheritance;
  cycle: AcousticCycleGeometry;
  layerRecipes: AcousticLayerRecipe[];
  virtualTransmission: AcousticVirtualTransmissionRecipe;
  sampleBankRecipe: AcousticSampleBankRecipe;
  headroom: AcousticHeadroomRecipe;
  listening: AcousticListeningAcceptance;
}

export interface AcousticProfileSpec {
  id: string;
  /** Authoritative technical family for motion/routing — equals familyForProfile(id). */
  family: ProfileFamily;
  /** Package INDEX / Markdown technical family (design intent). */
  packageFamily: ProfileFamily;
  /** Set only when packageFamily !== family. Never consume in synth/motion. */
  familyMismatch: AcousticFamilyMismatch | null;
  layers: AcousticLayerPlan;
  controls: AcousticControlMap;
  /** RPM/load/regime descriptors from catalog + experience config. */
  regimes: AcousticRegimeModel;
  dsp: AcousticDspLimits;
  events: AcousticEventGates;
  loudness: AcousticLoudnessLimits;
  sampleBank: AcousticSampleBankHook;
  acceptance: AcousticAcceptanceMeta;
  /**
   * Extended per-ID recipe (Prompt 02). Serializable; unused by live audio until flagged.
   * Listening verdicts live only under recipe.listening.
   */
  recipe: AcousticRecipe;
}
