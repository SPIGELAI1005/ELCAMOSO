import { intensityBand, type IntensityBand, type SoundProfile } from "@/lib/sound/profiles";

/** Master ceiling by profile intensity, on top of the engine limiter (0.85). */
export const BAND_CEILING: Record<IntensityBand, number> = {
  gentle: 0.85,
  balanced: 0.74,
  intense: 0.58,
};

export function intensityCeiling(profile: SoundProfile): number {
  return BAND_CEILING[intensityBand(profile)];
}

export function cappedGain(volume: number, profileGain: number, profile: SoundProfile): number {
  const raw = volume * profileGain;
  return Math.min(intensityCeiling(profile), raw);
}

export function needsIntenseConfirm(profile: SoundProfile, volume: number, profileGain: number): boolean {
  return intensityBand(profile) === "intense" && volume * profileGain > 0.55;
}
