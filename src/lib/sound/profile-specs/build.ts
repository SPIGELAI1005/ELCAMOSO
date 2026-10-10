import { familyForProfile } from "@/lib/sound/realism/families";
import { loudnessForProfile } from "@/lib/sound/realism/loudness";
import {
  profileExperienceConfig,
  type ProfileExperienceConfig,
} from "@/lib/sound/profile-experience-config";
import { getProfile } from "@/lib/sound/profiles";
import { isCombustionRealismV2Profile } from "@/lib/sound/realism/v2";
import {
  familyMismatchForProfile,
  packageFamilyForProfile,
} from "@/lib/sound/profile-specs/package-family";
import type { AcousticProfileSpec } from "@/lib/sound/profile-specs/types";
import { validateAcousticProfileSpec } from "@/lib/sound/profile-specs/validate";

/** Mirrors SoundEngine.MAX_GAIN — kept local so profile-specs never import the engine graph. */
const MAX_GAIN_CEILING = 0.85;

const FALLBACK_EXPERIENCE: ProfileExperienceConfig = {
  physics: "intentional-design",
  pitchDriver: "energy",
  loadDriver: "motion-energy",
  aspiration: "unknown",
  availableRoles: ["core"],
  transitionTauSeconds: 0.16,
  phases: {
    idleCharacter: 1,
    pullAwayTexture: 1,
    accelerationTexture: 1,
    cruiseIntrusiveScale: 0.72,
    releaseCharacter: 0.65,
    regenCharacter: 0,
    stopTail: 0.5,
  },
  variation: { depth: 0.025, minEventCooldownSeconds: 4, maxEventVoices: 2 },
  aspirationDynamics: {
    attackSeconds: 0,
    decaySeconds: 0,
    minimumReleaseState: 0,
    speedRatio: 0,
  },
  status: "procedural upgrade",
};

function personalityHintFor(profileId: string): string | null {
  if (!isCombustionRealismV2Profile(profileId)) return null;
  try {
    const profile = getProfile(profileId);
    return profile.drivetrainPersonalityId ?? profileId;
  } catch {
    return profileId;
  }
}

const PHASE_KEYS = [
  "idleCharacter",
  "pullAwayTexture",
  "accelerationTexture",
  "cruiseIntrusiveScale",
  "releaseCharacter",
  "regenCharacter",
  "stopTail",
] as const;

/** Build a validated AcousticProfileSpec from existing catalog/config sources only. */
export function buildAcousticProfileSpec(profileId: string): AcousticProfileSpec {
  const experience = profileExperienceConfig(profileId) ?? FALLBACK_EXPERIENCE;
  const family = familyForProfile(profileId);
  const packageFamily = packageFamilyForProfile(profileId);
  const profile = getProfile(profileId);
  const hasForcedInductionDynamics =
    experience.aspirationDynamics.attackSeconds > 0 ||
    experience.aspirationDynamics.decaySeconds > 0 ||
    experience.aspiration === "turbocharged" ||
    experience.aspiration === "supercharged";

  const raw: AcousticProfileSpec = {
    id: profileId,
    family,
    packageFamily,
    familyMismatch: familyMismatchForProfile(profileId),
    layers: { roles: experience.availableRoles },
    controls: {
      pitchDriver: experience.pitchDriver,
      loadDriver: experience.loadDriver,
    },
    regimes: {
      drivetrainMode: profile.drivetrainMode,
      motionModel: profile.motionModel ?? null,
      drivetrainPersonalityId: profile.drivetrainPersonalityId ?? null,
      phaseKeys: PHASE_KEYS,
      hasForcedInductionDynamics,
      realismV2Combustion: isCombustionRealismV2Profile(profileId),
    },
    dsp: {
      transitionTauSeconds: experience.transitionTauSeconds,
      aspiration: experience.aspiration,
      aspirationDynamics: { ...experience.aspirationDynamics },
      phases: { ...experience.phases },
    },
    events: {
      variationDepth: experience.variation.depth,
      minEventCooldownSeconds: experience.variation.minEventCooldownSeconds,
      maxEventVoices: experience.variation.maxEventVoices,
    },
    loudness: {
      profileTrim: loudnessForProfile(profileId),
      maxGainCeiling: MAX_GAIN_CEILING,
    },
    sampleBank: {
      personalityHint: personalityHintFor(profileId),
      approvedAssetsPresent: false,
    },
    acceptance: {
      physics: experience.physics,
      status: experience.status,
    },
  };

  return validateAcousticProfileSpec(raw);
}
