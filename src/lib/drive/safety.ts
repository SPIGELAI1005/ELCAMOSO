import { intensityBand, type IntensityBand, type SoundProfile } from "@/lib/sound/profiles";
import { USER_STAGE_CEILING } from "@/lib/sound/gain-staging/constants";
import { computeUserStageLinearGain } from "@/lib/sound/gain-staging/compute";

/** Pre-boost user-stage ceiling by profile intensity (Prompt 08). */
export const BAND_CEILING: Record<IntensityBand, number> = {
  gentle: USER_STAGE_CEILING,
  balanced: 0.82,
  intense: 0.7,
};

export function intensityCeiling(profile: SoundProfile): number {
  return BAND_CEILING[intensityBand(profile)];
}

/**
 * Linear gain for diagnostics / intense-confirm UI.
 * Runtime audio uses SoundEngine.setVolume(ui) + setProfileGain separately
 * (avoids double-applying profileGain — Prompt 08 audit fix).
 */
export function cappedGain(volume: number, profileGain: number, profile: SoundProfile): number {
  return computeUserStageLinearGain({
    uiVolume: volume,
    profileGain,
    loudnessTrim: 1,
    outputBoostDb: 0,
    loadScale: 1,
    intensityCeiling: intensityCeiling(profile),
  });
}

export function needsIntenseConfirm(
  profile: SoundProfile,
  volume: number,
  profileGain: number,
): boolean {
  return intensityBand(profile) === "intense" && volume * profileGain > 0.55;
}
