/**
 * Executable per-profile sound identity and driving-phase configuration.
 *
 * Public catalog metadata stays in profiles.ts. Human sound-design prose stays
 * in docs/sound-profiles and docs/audio/profile-upgrade-matrix.md. This module
 * contains bounded runtime controls only.
 */

import { applyExperienceCatalogTuning } from "@/lib/sound/realism/catalog-tuning/apply";

export const PUBLIC_PROFILE_IDS = [
  "gt-v8", "racing-v10", "cyber-pulse", "race-car", "rally-car", "space-ship", "ufo",
  "speed-boat", "cruise-ship", "santa-sleigh", "wild-west-carriage", "romanian-85-carriage",
  "laughing-machine", "farting-car", "steam-train", "kazoo-kart", "turbine-jet", "helicopter",
  "private-jet", "wiesn-tractor", "open-wind", "storm-glider", "flat-six-sport",
  "american-muscle-v8", "turbo-inline-6", "electric-hypercar", "formula-electric", "neon-drive",
  "maglev-train", "high-speed-train", "submarine", "jet-ski", "motorcycle-superbike", "big-twin",
  "snowmobile", "tank", "construction-monster", "horse-gallop", "dragon", "thunder-beast",
  "retro-arcade", "synthwave-drive", "deep-bass-pulse", "zen-drive", "rain-drive", "ocean-drive",
  "heartbeat", "rocket-car", "time-machine", "symphony-cinematic-rock", "symphony-motion-orchestra", "symphony-neon-run",
  "world-space-drive", "world-cyber-city", "world-storm-run", "fusion-road-anthem",
  "fusion-mechanical-symphony", "fusion-midnight-boost", "fusion-future-pulse",
] as const;

export type PublicProfileId = (typeof PUBLIC_PROFILE_IDS)[number];
export type AudioLayerRole =
  | "core"
  | "combustion"
  | "motor"
  | "intake"
  | "exhaust"
  | "boost"
  | "mechanical"
  | "regen"
  | "environment"
  | "music"
  | "event";
export type ProfilePhysics = "physical" | "physical-inspired" | "intentional-design" | "hybrid";
export type ProfileUpgradeStatus = "unchanged" | "procedural upgrade" | "hybrid" | "listening verified";
export type PitchDriver = "engine-rpm" | "motor-speed" | "vehicle-speed" | "cadence" | "energy" | "fixed";
export type LoadDriver = "simulated-load" | "torque-demand" | "motion-energy" | "environment-energy";
export type AspirationKind = "naturally-aspirated" | "turbocharged" | "supercharged" | "not-applicable" | "unknown";

export interface ProfileExperienceConfig {
  physics: ProfilePhysics;
  pitchDriver: PitchDriver;
  loadDriver: LoadDriver;
  aspiration: AspirationKind;
  availableRoles: readonly AudioLayerRole[];
  /** Seconds; all runtime transitions are smoothed to this lower bound. */
  transitionTauSeconds: number;
  /** Role-neutral phase controls. 1 preserves the strategy's authored level. */
  phases: {
    idleCharacter: number;
    pullAwayTexture: number;
    accelerationTexture: number;
    cruiseIntrusiveScale: number;
    releaseCharacter: number;
    regenCharacter: number;
    stopTail: number;
  };
  /** Bounded deterministic variation and event limits. */
  variation: { depth: number; minEventCooldownSeconds: number; maxEventVoices: number };
  /** Aspiration dynamics; zero when not applicable. */
  aspirationDynamics: {
    attackSeconds: number;
    decaySeconds: number;
    minimumReleaseState: number;
    speedRatio: number;
  };
  status: ProfileUpgradeStatus;
}

type ConfigInput = Omit<ProfileExperienceConfig, "phases" | "variation" | "aspirationDynamics" | "status"> & {
  phases?: Partial<ProfileExperienceConfig["phases"]>;
  variation?: Partial<ProfileExperienceConfig["variation"]>;
  aspirationDynamics?: Partial<ProfileExperienceConfig["aspirationDynamics"]>;
  status?: ProfileUpgradeStatus;
};

const DEFAULT_PHASES: ProfileExperienceConfig["phases"] = {
  idleCharacter: 1,
  pullAwayTexture: 1,
  accelerationTexture: 1,
  cruiseIntrusiveScale: 0.72,
  releaseCharacter: 0.65,
  regenCharacter: 0,
  stopTail: 0.5,
};

function define(input: ConfigInput): ProfileExperienceConfig {
  return {
    ...input,
    phases: { ...DEFAULT_PHASES, ...input.phases },
    variation: { depth: 0.025, minEventCooldownSeconds: 4, maxEventVoices: 2, ...input.variation },
    aspirationDynamics: {
      attackSeconds: 0,
      decaySeconds: 0,
      minimumReleaseState: 0,
      speedRatio: 0,
      ...input.aspirationDynamics,
    },
    status: input.status ?? "procedural upgrade",
  };
}

const combustion = (input: Omit<ConfigInput, "physics" | "pitchDriver" | "loadDriver">) =>
  define({ physics: "physical-inspired", pitchDriver: "engine-rpm", loadDriver: "simulated-load", ...input });
const motion = (input: Omit<ConfigInput, "physics" | "loadDriver"> & { physics?: ProfilePhysics }) =>
  define({ physics: input.physics ?? "physical-inspired", loadDriver: "motion-energy", ...input });
const designed = (input: Omit<ConfigInput, "physics" | "loadDriver">) =>
  define({ physics: "intentional-design", loadDriver: "motion-energy", ...input });
const musical = (roles: readonly AudioLayerRole[], overrides: Partial<ConfigInput> = {}) =>
  define({
    ...overrides,
    physics: overrides.physics ?? "intentional-design",
    pitchDriver: overrides.pitchDriver ?? "energy",
    loadDriver: overrides.loadDriver ?? "motion-energy",
    aspiration: overrides.aspiration ?? "not-applicable",
    availableRoles: overrides.availableRoles ?? roles,
    transitionTauSeconds: overrides.transitionTauSeconds ?? 0.16,
    phases: {
      cruiseIntrusiveScale: 0.62,
      accelerationTexture: 1.12,
      releaseCharacter: 0.72,
      ...overrides.phases,
    },
    variation: {
      depth: 0.018,
      minEventCooldownSeconds: 6,
      maxEventVoices: 2,
      ...overrides.variation,
    },
  });

export const PROFILE_EXPERIENCE_CONFIG = {
  "gt-v8": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.11, phases: { idleCharacter: 0.92, accelerationTexture: 1.08, cruiseIntrusiveScale: 0.92, releaseCharacter: 0.42 } }),
  "racing-v10": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.055, phases: { idleCharacter: 0.82, pullAwayTexture: 0.92, accelerationTexture: 1.24, cruiseIntrusiveScale: 0.90, releaseCharacter: 0.5 }, variation: { depth: 0.012, minEventCooldownSeconds: 7 } }),
  "cyber-pulse": designed({ pitchDriver: "motor-speed", aspiration: "not-applicable", availableRoles: ["motor", "regen", "environment", "event"], transitionTauSeconds: 0.12, phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.62, releaseCharacter: 0.42, regenCharacter: 0.88 } }),
  "race-car": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.045, phases: { idleCharacter: 0.78, accelerationTexture: 1.28, cruiseIntrusiveScale: 0.88, releaseCharacter: 0.58 }, variation: { depth: 0.01, minEventCooldownSeconds: 5 } }),
  "rally-car": combustion({ aspiration: "turbocharged", availableRoles: ["combustion", "intake", "exhaust", "boost", "mechanical", "event", "environment"], transitionTauSeconds: 0.05, phases: { accelerationTexture: 1.2, cruiseIntrusiveScale: 0.88, releaseCharacter: 0.8 }, variation: { depth: 0.025, minEventCooldownSeconds: 4, maxEventVoices: 2 }, aspirationDynamics: { attackSeconds: 0.48, decaySeconds: 0.34, minimumReleaseState: 0.58 } }),
  "space-ship": designed({ pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.24, phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.7, releaseCharacter: 0.62, stopTail: 0.82 } }),
  "ufo": designed({ pitchDriver: "vehicle-speed", aspiration: "not-applicable", availableRoles: ["core", "environment", "event"], transitionTauSeconds: 0.2, phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.64, releaseCharacter: 0.78 }, variation: { depth: 0.018, minEventCooldownSeconds: 8 } }),
  "speed-boat": motion({ pitchDriver: "engine-rpm", aspiration: "unknown", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.16, phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.64 } }),
  "cruise-ship": motion({ pitchDriver: "engine-rpm", aspiration: "unknown", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.4, phases: { accelerationTexture: 1.04, cruiseIntrusiveScale: 0.76, releaseCharacter: 0.78, stopTail: 0.9 }, variation: { depth: 0.01, minEventCooldownSeconds: 28, maxEventVoices: 1 } }),
  "santa-sleigh": designed({ pitchDriver: "cadence", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.18, phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.66 }, variation: { depth: 0.022, minEventCooldownSeconds: 12, maxEventVoices: 1 } }),
  "wild-west-carriage": motion({ physics: "physical-inspired", pitchDriver: "cadence", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.16, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.64, releaseCharacter: 0.62 }, variation: { minEventCooldownSeconds: 14, maxEventVoices: 1 } }),
  "romanian-85-carriage": motion({ physics: "physical-inspired", pitchDriver: "cadence", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment"], transitionTauSeconds: 0.22, phases: { accelerationTexture: 1.06, cruiseIntrusiveScale: 0.72, releaseCharacter: 0.7 } }),
  "laughing-machine": designed({ pitchDriver: "cadence", aspiration: "not-applicable", availableRoles: ["core", "environment", "event"], transitionTauSeconds: 0.14, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.5, releaseCharacter: 0.58 }, variation: { minEventCooldownSeconds: 5, maxEventVoices: 1 } }),
  "farting-car": designed({ pitchDriver: "engine-rpm", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "event"], transitionTauSeconds: 0.12, phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.48, releaseCharacter: 0.9 }, variation: { minEventCooldownSeconds: 2.2, maxEventVoices: 1 } }),
  "steam-train": motion({ pitchDriver: "cadence", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.18, phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.7, releaseCharacter: 0.72 }, variation: { minEventCooldownSeconds: 18, maxEventVoices: 1 } }),
  "kazoo-kart": designed({ pitchDriver: "engine-rpm", aspiration: "not-applicable", availableRoles: ["core", "intake", "mechanical", "event"], transitionTauSeconds: 0.07, phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.46, releaseCharacter: 0.6 }, variation: { depth: 0.015, minEventCooldownSeconds: 4, maxEventVoices: 1 } }),
  "turbine-jet": motion({ pitchDriver: "engine-rpm", aspiration: "not-applicable", availableRoles: ["core", "intake", "mechanical", "environment"], transitionTauSeconds: 0.5, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.72, releaseCharacter: 0.74 } }),
  "helicopter": motion({ pitchDriver: "fixed", aspiration: "unknown", availableRoles: ["core", "mechanical", "environment"], transitionTauSeconds: 0.3, phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.76, releaseCharacter: 0.74 } }),
  "private-jet": motion({ pitchDriver: "engine-rpm", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment"], transitionTauSeconds: 0.58, phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.74, releaseCharacter: 0.78 } }),
  "wiesn-tractor": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.55, phases: { idleCharacter: 1.12, pullAwayTexture: 1.05, accelerationTexture: 1.08, cruiseIntrusiveScale: 0.8, releaseCharacter: 0.76 } }),
  "open-wind": motion({ pitchDriver: "vehicle-speed", aspiration: "not-applicable", availableRoles: ["environment"], transitionTauSeconds: 0.38, phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.76, releaseCharacter: 0.82 } }),
  "storm-glider": designed({ pitchDriver: "vehicle-speed", aspiration: "not-applicable", availableRoles: ["core", "environment", "event"], transitionTauSeconds: 0.3, phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.64, releaseCharacter: 0.82 }, variation: { minEventCooldownSeconds: 20, maxEventVoices: 1 } }),
  "flat-six-sport": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.065, phases: { idleCharacter: 0.9, accelerationTexture: 1.22, cruiseIntrusiveScale: 0.91, releaseCharacter: 0.48 } }),
  "american-muscle-v8": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.12, phases: { idleCharacter: 1.14, pullAwayTexture: 1.12, accelerationTexture: 1.18, cruiseIntrusiveScale: 0.92, releaseCharacter: 0.78 }, status: "hybrid" }),
  "turbo-inline-6": combustion({ aspiration: "turbocharged", availableRoles: ["combustion", "intake", "exhaust", "boost", "mechanical", "event"], transitionTauSeconds: 0.08, phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.90, releaseCharacter: 0.66 }, aspirationDynamics: { attackSeconds: 0.62, decaySeconds: 0.42, minimumReleaseState: 0.6 } }),
  "electric-hypercar": define({ physics: "intentional-design", pitchDriver: "motor-speed", loadDriver: "torque-demand", aspiration: "not-applicable", availableRoles: ["motor", "mechanical", "regen", "environment", "event"], transitionTauSeconds: 0.07, phases: { idleCharacter: 0.3, pullAwayTexture: 1.08, accelerationTexture: 1.18, cruiseIntrusiveScale: 0.56, releaseCharacter: 0.46, regenCharacter: 1, stopTail: 0.3 } }),
  "formula-electric": define({ physics: "physical-inspired", pitchDriver: "motor-speed", loadDriver: "torque-demand", aspiration: "not-applicable", availableRoles: ["motor", "mechanical", "regen", "environment"], transitionTauSeconds: 0.055, phases: { idleCharacter: 0.15, accelerationTexture: 1.22, cruiseIntrusiveScale: 0.52, releaseCharacter: 0.42, regenCharacter: 0.82, stopTail: 0.25 } }),
  "neon-drive": musical(["core", "music", "regen", "event"], { transitionTauSeconds: 0.14, phases: { cruiseIntrusiveScale: 0.56, accelerationTexture: 1.14, regenCharacter: 0.64 } }),
  "maglev-train": motion({ pitchDriver: "motor-speed", aspiration: "not-applicable", availableRoles: ["motor", "mechanical", "environment"], transitionTauSeconds: 0.3, phases: { accelerationTexture: 1.1, cruiseIntrusiveScale: 0.68, releaseCharacter: 0.76, regenCharacter: 0.58 } }),
  "high-speed-train": motion({ pitchDriver: "motor-speed", aspiration: "not-applicable", availableRoles: ["motor", "mechanical", "environment"], transitionTauSeconds: 0.28, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.72, regenCharacter: 0.52 } }),
  "submarine": motion({ pitchDriver: "motor-speed", aspiration: "not-applicable", availableRoles: ["motor", "mechanical", "environment", "event"], transitionTauSeconds: 0.45, phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.74, releaseCharacter: 0.82 }, variation: { minEventCooldownSeconds: 12, maxEventVoices: 1 } }),
  "jet-ski": motion({ pitchDriver: "engine-rpm", aspiration: "unknown", availableRoles: ["core", "intake", "mechanical", "environment", "event"], transitionTauSeconds: 0.11, phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.6, releaseCharacter: 0.62 } }),
  "motorcycle-superbike": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.04, phases: { idleCharacter: 0.72, accelerationTexture: 1.28, cruiseIntrusiveScale: 0.86, releaseCharacter: 0.45 }, variation: { depth: 0.008, minEventCooldownSeconds: 5 } }),
  "big-twin": combustion({ aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "event"], transitionTauSeconds: 0.16, phases: { idleCharacter: 1.12, pullAwayTexture: 1.08, accelerationTexture: 1.12, cruiseIntrusiveScale: 0.92, releaseCharacter: 0.82 } }),
  "snowmobile": motion({ pitchDriver: "engine-rpm", aspiration: "naturally-aspirated", availableRoles: ["combustion", "mechanical", "environment"], transitionTauSeconds: 0.09, phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.6 } }),
  "tank": motion({ pitchDriver: "engine-rpm", aspiration: "unknown", availableRoles: ["core", "mechanical", "environment"], transitionTauSeconds: 0.32, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.7, releaseCharacter: 0.76 } }),
  "construction-monster": motion({ pitchDriver: "engine-rpm", aspiration: "unknown", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.28, phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.68, releaseCharacter: 0.74 }, variation: { minEventCooldownSeconds: 8, maxEventVoices: 1 } }),
  "horse-gallop": motion({ pitchDriver: "cadence", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment"], transitionTauSeconds: 0.2, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.68, releaseCharacter: 0.72 } }),
  "dragon": designed({ pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.24, phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.74 }, variation: { minEventCooldownSeconds: 8, maxEventVoices: 1 } }),
  "thunder-beast": designed({ pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.28, phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.62, releaseCharacter: 0.8 }, variation: { minEventCooldownSeconds: 14, maxEventVoices: 1 } }),
  "retro-arcade": musical(["core", "music", "event"], { transitionTauSeconds: 0.08, phases: { cruiseIntrusiveScale: 0.52, accelerationTexture: 1.1 }, variation: { depth: 0.008, minEventCooldownSeconds: 3, maxEventVoices: 1 } }),
  "synthwave-drive": musical(["core", "music", "environment", "event"], { transitionTauSeconds: 0.16, phases: { cruiseIntrusiveScale: 0.6, accelerationTexture: 1.1 } }),
  "deep-bass-pulse": musical(["core", "music"], { transitionTauSeconds: 0.2, phases: { cruiseIntrusiveScale: 0.68, accelerationTexture: 1.06 }, variation: { depth: 0.008, minEventCooldownSeconds: 8, maxEventVoices: 1 } }),
  "zen-drive": motion({ physics: "intentional-design", pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["core", "environment", "event"], transitionTauSeconds: 0.5, phases: { accelerationTexture: 1.04, cruiseIntrusiveScale: 0.78, releaseCharacter: 0.84 }, variation: { depth: 0.01, minEventCooldownSeconds: 18, maxEventVoices: 1 } }),
  "rain-drive": motion({ physics: "intentional-design", pitchDriver: "vehicle-speed", aspiration: "not-applicable", availableRoles: ["environment"], transitionTauSeconds: 0.34, phases: { accelerationTexture: 1.08, cruiseIntrusiveScale: 0.72, releaseCharacter: 0.82 } }),
  "ocean-drive": motion({ physics: "intentional-design", pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["environment"], transitionTauSeconds: 0.6, phases: { accelerationTexture: 1.04, cruiseIntrusiveScale: 0.8, releaseCharacter: 0.88 } }),
  "heartbeat": musical(["core", "music", "event"], { transitionTauSeconds: 0.24, phases: { cruiseIntrusiveScale: 0.7, accelerationTexture: 1.08 }, variation: { depth: 0.006, minEventCooldownSeconds: 8, maxEventVoices: 1 } }),
  "rocket-car": designed({ pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.2, phases: { accelerationTexture: 1.22, cruiseIntrusiveScale: 0.7, releaseCharacter: 0.66, stopTail: 0.85 }, variation: { depth: 0.02, minEventCooldownSeconds: 3, maxEventVoices: 2 } }),
  "time-machine": designed({ pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["core", "mechanical", "environment", "event"], transitionTauSeconds: 0.22, phases: { accelerationTexture: 1.18, cruiseIntrusiveScale: 0.66, releaseCharacter: 0.72, stopTail: 0.9 }, variation: { depth: 0.025, minEventCooldownSeconds: 4, maxEventVoices: 2 } }),
  "symphony-cinematic-rock": musical(["music", "event"], { transitionTauSeconds: 0.18, physics: "intentional-design", phases: { cruiseIntrusiveScale: 0.56, accelerationTexture: 1.14 } }),
  "symphony-motion-orchestra": musical(["music", "event"], { transitionTauSeconds: 0.22, physics: "intentional-design", phases: { cruiseIntrusiveScale: 0.58, accelerationTexture: 1.12 } }),
  "symphony-neon-run": musical(["music", "event"], { transitionTauSeconds: 0.14, physics: "intentional-design", phases: { cruiseIntrusiveScale: 0.54, accelerationTexture: 1.12 } }),
  "world-space-drive": designed({ pitchDriver: "energy", aspiration: "not-applicable", availableRoles: ["core", "environment", "event"], transitionTauSeconds: 0.24, phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.62, releaseCharacter: 0.76 } }),
  "world-cyber-city": designed({ pitchDriver: "vehicle-speed", aspiration: "not-applicable", availableRoles: ["core", "environment", "event"], transitionTauSeconds: 0.18, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.68 }, variation: { minEventCooldownSeconds: 7, maxEventVoices: 2 } }),
  "world-storm-run": designed({ pitchDriver: "vehicle-speed", aspiration: "not-applicable", availableRoles: ["core", "environment", "event"], transitionTauSeconds: 0.22, phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.6, releaseCharacter: 0.8 }, variation: { minEventCooldownSeconds: 16, maxEventVoices: 1 } }),
  "fusion-road-anthem": define({ physics: "hybrid", pitchDriver: "engine-rpm", loadDriver: "motion-energy", aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "music", "event"], transitionTauSeconds: 0.14, phases: { accelerationTexture: 1.12, cruiseIntrusiveScale: 0.6, releaseCharacter: 0.5 } }),
  "fusion-mechanical-symphony": define({ physics: "hybrid", pitchDriver: "engine-rpm", loadDriver: "motion-energy", aspiration: "naturally-aspirated", availableRoles: ["combustion", "intake", "exhaust", "mechanical", "music", "event"], transitionTauSeconds: 0.1, phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.58, releaseCharacter: 0.48 } }),
  "fusion-midnight-boost": define({ physics: "hybrid", pitchDriver: "engine-rpm", loadDriver: "motion-energy", aspiration: "turbocharged", availableRoles: ["combustion", "intake", "exhaust", "boost", "mechanical", "music", "event"], transitionTauSeconds: 0.1, phases: { accelerationTexture: 1.14, cruiseIntrusiveScale: 0.56, releaseCharacter: 0.68 }, aspirationDynamics: { attackSeconds: 0.62, decaySeconds: 0.42, minimumReleaseState: 0.6 } }),
  "fusion-future-pulse": define({ physics: "hybrid", pitchDriver: "motor-speed", loadDriver: "torque-demand", aspiration: "not-applicable", availableRoles: ["motor", "mechanical", "regen", "music", "event"], transitionTauSeconds: 0.1, phases: { accelerationTexture: 1.16, cruiseIntrusiveScale: 0.54, releaseCharacter: 0.52, regenCharacter: 0.84 } }),
} satisfies Record<PublicProfileId, ProfileExperienceConfig>;

/** Untuned experience config (Prompt 07 baselines). Prefer profileExperienceConfig at runtime. */
export function profileExperienceConfigBase(profileId: string): ProfileExperienceConfig | null {
  return (PROFILE_EXPERIENCE_CONFIG as Record<string, ProfileExperienceConfig>)[profileId] ?? null;
}

/** Runtime experience config including Prompt 07 catalog overlays. */
export function profileExperienceConfig(profileId: string): ProfileExperienceConfig | null {
  const base = profileExperienceConfigBase(profileId);
  if (!base) return null;
  return applyExperienceCatalogTuning(profileId, base);
}
