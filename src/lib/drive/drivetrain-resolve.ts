import type { SoundProfile } from "@/lib/sound/profiles";
import { getProfile } from "@/lib/sound/profiles";
import {
  getDrivetrainPersonality,
  personalityLegacyTransmission,
  personalityToPowertrain,
  type DrivetrainPersonalityConfig,
  type DrivetrainMotionTuning,
  type TransientAudioConfig,
} from "@/lib/drive/drivetrain-personalities";
import type { PowertrainProfile } from "@/lib/powertrain/profiles";

/** Fallback when a Sound Profile has no explicit personality (older saves / unmapped profiles). */
const LEGACY_PERSONALITY_BY_SOUND: Record<string, string> = {
  "gt-v8": "gt-v8",
  "racing-v10": "flat-six-sport",
  "race-car": "flat-six-sport",
  "rally-car": "turbo-inline-6",
  "motorcycle-superbike": "motorcycle-inline-4",
  "big-twin": "v-twin-cruiser",
  "wiesn-tractor": "single-cylinder-ag",
  "kazoo-kart": "turbo-inline-6",
  "farting-car": "american-v8",
};

const DEFAULT_PERSONALITY_ID = "gt-v8";

export interface ResolvedDrivetrain {
  personalityId: string;
  personality: DrivetrainPersonalityConfig;
  powertrain: PowertrainProfile;
  transient: TransientAudioConfig;
  motion: DrivetrainMotionTuning;
}

export function resolvePersonalityId(soundProfile: SoundProfile): string {
  if (soundProfile.drivetrainPersonalityId) return soundProfile.drivetrainPersonalityId;
  if (soundProfile.baseId && LEGACY_PERSONALITY_BY_SOUND[soundProfile.baseId]) {
    return LEGACY_PERSONALITY_BY_SOUND[soundProfile.baseId]!;
  }
  return LEGACY_PERSONALITY_BY_SOUND[soundProfile.id] ?? DEFAULT_PERSONALITY_ID;
}

export function resolveDrivetrain(soundProfile: SoundProfile): ResolvedDrivetrain {
  const personalityId = resolvePersonalityId(soundProfile);
  const personality = getDrivetrainPersonality(personalityId);
  return {
    personalityId,
    personality,
    powertrain: personalityToPowertrain(personality),
    transient: personality.transient,
    motion: personality.motion,
  };
}

export function powertrainProfileForSound(soundProfile: SoundProfile | string): PowertrainProfile {
  const profile = typeof soundProfile === "string" ? getProfile(soundProfile) : soundProfile;
  return resolveDrivetrain(profile).powertrain;
}

export function supportsDynamicDrive(soundProfile: SoundProfile): boolean {
  return soundProfile.drivetrainMode === "virtual-transmission";
}

/** Apply personality legacy transmission to a Sound Profile copy (for computeDriveState). */
export function withPersonalityTransmission(profile: SoundProfile): SoundProfile {
  if (profile.drivetrainMode !== "virtual-transmission") return profile;
  const personality = getDrivetrainPersonality(resolvePersonalityId(profile));
  return {
    ...profile,
    transmission: personalityLegacyTransmission(personality),
  };
}
