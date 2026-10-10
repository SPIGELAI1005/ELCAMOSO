import type { ProfileFamily } from "@/lib/sound/realism/families";
import type {
  AcousticAspirationDynamics,
  AcousticEventGates,
  AcousticLoudnessLimits,
  AcousticPhaseMix,
  AcousticProfileSpec,
} from "@/lib/sound/profile-specs/types";

const FAMILIES: readonly ProfileFamily[] = ["physical", "designed", "environmental", "musical"];

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampPhase(phases: AcousticPhaseMix): AcousticPhaseMix {
  return {
    idleCharacter: clamp(phases.idleCharacter, 0, 2),
    pullAwayTexture: clamp(phases.pullAwayTexture, 0, 2),
    accelerationTexture: clamp(phases.accelerationTexture, 0, 2),
    cruiseIntrusiveScale: clamp(phases.cruiseIntrusiveScale, 0, 2),
    releaseCharacter: clamp(phases.releaseCharacter, 0, 2),
    regenCharacter: clamp(phases.regenCharacter, 0, 2),
    stopTail: clamp(phases.stopTail, 0, 2),
  };
}

function clampAspiration(d: AcousticAspirationDynamics): AcousticAspirationDynamics {
  return {
    attackSeconds: clamp(d.attackSeconds, 0, 8),
    decaySeconds: clamp(d.decaySeconds, 0, 8),
    minimumReleaseState: clamp(d.minimumReleaseState, 0, 1),
    speedRatio: clamp(d.speedRatio, 0, 4),
  };
}

function clampEvents(events: AcousticEventGates): AcousticEventGates {
  return {
    variationDepth: clamp(events.variationDepth, 0, 0.2),
    minEventCooldownSeconds: clamp(events.minEventCooldownSeconds, 0, 120),
    maxEventVoices: Math.round(clamp(events.maxEventVoices, 0, 8)),
  };
}

function clampLoudness(loudness: AcousticLoudnessLimits): AcousticLoudnessLimits {
  return {
    profileTrim: clamp(loudness.profileTrim, 0.4, 1.6),
    maxGainCeiling: clamp(loudness.maxGainCeiling, 0.2, 0.85),
  };
}

function isFamily(value: unknown): value is ProfileFamily {
  return typeof value === "string" && (FAMILIES as readonly string[]).includes(value);
}

/**
 * Clamp numeric limits and repair invalid family labels without inventing new recipes.
 * Safe fallbacks never change SoundEngine / familyForProfile behaviour by themselves.
 */
export function validateAcousticProfileSpec(spec: AcousticProfileSpec): AcousticProfileSpec {
  const family = isFamily(spec.family) ? spec.family : "physical";
  const packageFamily = isFamily(spec.packageFamily) ? spec.packageFamily : family;
  const mismatch =
    family === packageFamily
      ? null
      : spec.familyMismatch &&
          isFamily(spec.familyMismatch.runtimeFamily) &&
          isFamily(spec.familyMismatch.packageFamily)
        ? {
            ...spec.familyMismatch,
            runtimeFamily: family,
            packageFamily,
          }
        : {
            runtimeFamily: family,
            packageFamily,
            deferredReason:
              spec.familyMismatch?.deferredReason ??
              "Package and runtime families differ; runtime family preserved for routing.",
            documentation:
              spec.familyMismatch?.documentation ?? "docs/FAMILY_CLASSIFICATION_MISMATCHES.md",
          };

  const drivetrainMode =
    spec.regimes?.drivetrainMode === "virtual-transmission" ||
    spec.regimes?.drivetrainMode === "continuous"
      ? spec.regimes.drivetrainMode
      : "continuous";

  return {
    ...spec,
    id: typeof spec.id === "string" && spec.id.length > 0 ? spec.id : "unknown",
    family,
    packageFamily,
    familyMismatch: mismatch,
    layers: {
      roles: Array.isArray(spec.layers?.roles) ? spec.layers.roles : ["core"],
    },
    controls: {
      pitchDriver: spec.controls?.pitchDriver ?? "energy",
      loadDriver: spec.controls?.loadDriver ?? "motion-energy",
    },
    regimes: {
      drivetrainMode,
      motionModel: spec.regimes?.motionModel ?? null,
      drivetrainPersonalityId:
        typeof spec.regimes?.drivetrainPersonalityId === "string"
          ? spec.regimes.drivetrainPersonalityId
          : null,
      phaseKeys: Array.isArray(spec.regimes?.phaseKeys)
        ? spec.regimes.phaseKeys
        : [
            "idleCharacter",
            "pullAwayTexture",
            "accelerationTexture",
            "cruiseIntrusiveScale",
            "releaseCharacter",
            "regenCharacter",
            "stopTail",
          ],
      hasForcedInductionDynamics: Boolean(spec.regimes?.hasForcedInductionDynamics),
      realismV2Combustion: Boolean(spec.regimes?.realismV2Combustion),
    },
    dsp: {
      transitionTauSeconds: clamp(spec.dsp?.transitionTauSeconds ?? 0.16, 0.02, 2),
      aspiration: spec.dsp?.aspiration ?? "unknown",
      aspirationDynamics: clampAspiration(
        spec.dsp?.aspirationDynamics ?? {
          attackSeconds: 0,
          decaySeconds: 0,
          minimumReleaseState: 0,
          speedRatio: 0,
        },
      ),
      phases: clampPhase(
        spec.dsp?.phases ?? {
          idleCharacter: 1,
          pullAwayTexture: 1,
          accelerationTexture: 1,
          cruiseIntrusiveScale: 0.72,
          releaseCharacter: 0.65,
          regenCharacter: 0,
          stopTail: 0.5,
        },
      ),
    },
    events: clampEvents(
      spec.events ?? {
        variationDepth: 0.025,
        minEventCooldownSeconds: 4,
        maxEventVoices: 2,
      },
    ),
    loudness: clampLoudness(
      spec.loudness ?? { profileTrim: 1, maxGainCeiling: 0.85 },
    ),
    sampleBank: {
      personalityHint:
        typeof spec.sampleBank?.personalityHint === "string"
          ? spec.sampleBank.personalityHint
          : null,
      approvedAssetsPresent: Boolean(spec.sampleBank?.approvedAssetsPresent),
    },
    acceptance: {
      physics: spec.acceptance?.physics ?? "intentional-design",
      status: spec.acceptance?.status ?? "procedural upgrade",
    },
  };
}
