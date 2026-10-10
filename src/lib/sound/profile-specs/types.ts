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
}
