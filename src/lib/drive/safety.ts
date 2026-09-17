import { intensityBand, type IntensityBand, type SoundProfile } from "@/lib/sound/profiles";
import { perceptualVolumeGain } from "@/lib/sound/perceptual-volume";

/** Master ceiling by profile intensity, on top of the engine limiter (0.85). */
export const BAND_CEILING: Record<IntensityBand, number> = {
  gentle: 0.85,
  balanced: 0.82,
  intense: 0.7,
};

export function intensityCeiling(profile: SoundProfile): number {
  return BAND_CEILING[intensityBand(profile)];
}

/**
 * Apply perceptual slider curve, then profile balance, then intensity ceiling.
 * Sensor source is intentionally not part of this path.
 */
export function cappedGain(volume: number, profileGain: number, profile: SoundProfile): number {
  const raw = perceptualVolumeGain(volume) * profileGain;
  return Math.min(intensityCeiling(profile), raw);
}

export function needsIntenseConfirm(
  profile: SoundProfile,
  volume: number,
  profileGain: number,
): boolean {
  return intensityBand(profile) === "intense" && volume * profileGain > 0.55;
}
