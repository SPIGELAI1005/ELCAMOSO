import { smoothToward } from "@/lib/sound/dsp/smoother";
import { dbToLinear } from "@/lib/sound/gain-staging/compute";

/** Intensity steps for "Match volume to speed". */
export type RoadLoudnessIntensity = "low" | "medium" | "high";

export const ROAD_LOUDNESS_INTENSITIES = ["low", "medium", "high"] as const;

export const ROAD_LOUDNESS_KNEE_KMH = 30;
export const ROAD_LOUDNESS_CAP_KMH = 130;
/** AudioParam / software smoother time constant — avoids GPS pumping. */
export const ROAD_LOUDNESS_TAU_SECONDS = 0.6;
export const ROAD_LOUDNESS_SHELF_HZ = 150;

/** Medium caps; Low is 50% of Medium, High is the published ceiling. */
export const ROAD_LOUDNESS_CAPS: Record<RoadLoudnessIntensity, { gainDb: number; bassDb: number }> =
  {
    low: { gainDb: 2, bassDb: 1.25 },
    medium: { gainDb: 4, bassDb: 2.5 },
    high: { gainDb: 6, bassDb: 4 },
  };

/** Calm-cabin level at/above the speed cap, before user-volume mute. ~−22 dB. */
export const CALM_CABIN_MAX_LINEAR = 10 ** (-22 / 20);

export const DEFAULT_MATCH_VOLUME_TO_SPEED = true;
export const DEFAULT_MATCH_VOLUME_TO_SPEED_INTENSITY: RoadLoudnessIntensity = "low";
export const DEFAULT_CALM_CABIN = false;
/** Master enable for the package (Drive toggle). Signed-in default; audio still requires sign-in. */
export const DEFAULT_NOISE_MASKING = true;

/** User-facing name (Drive toggle and Settings section heading). Rename here only. */
export const NOISE_MASKING_LABEL = "Noise masking";
/** Shown when a signed-out visitor taps a locked Noise masking control. */
export const NOISE_MASKING_SIGN_IN_REMARK = "Sign in or sign up to use this";

export function isRoadLoudnessIntensity(value: unknown): value is RoadLoudnessIntensity {
  return value === "low" || value === "medium" || value === "high";
}

export function sanitizeRoadLoudnessIntensity(value: unknown): RoadLoudnessIntensity {
  return isRoadLoudnessIntensity(value) ? value : DEFAULT_MATCH_VOLUME_TO_SPEED_INTENSITY;
}

/**
 * 0 below the knee, 1 at/above the cap. Smoothstep eases the ramp so the
 * first tens of km/h above 30 are gentler than a linear climb.
 */
export function roadLoudnessAmount(speedKmh: number): number {
  const v = Number.isFinite(speedKmh) ? speedKmh : 0;
  if (v <= ROAD_LOUDNESS_KNEE_KMH) return 0;
  if (v >= ROAD_LOUDNESS_CAP_KMH) return 1;
  const t = (v - ROAD_LOUDNESS_KNEE_KMH) / (ROAD_LOUDNESS_CAP_KMH - ROAD_LOUDNESS_KNEE_KMH);
  return t * t * (3 - 2 * t);
}

export interface RoadLoudnessInput {
  enabled: boolean;
  intensity: RoadLoudnessIntensity;
  speedKmh: number;
  /** UI slider 0..1; zero is true silence. */
  userVolume: number;
}

export interface RoadLoudnessTargets {
  gainDb: number;
  bassDb: number;
  gainLinear: number;
}

/** Instant (unsmoothed) targets for the post-boost, pre-peak-protect stage. */
export function roadLoudnessTargets(input: RoadLoudnessInput): RoadLoudnessTargets {
  if (!input.enabled || input.userVolume <= 0) {
    return { gainDb: 0, bassDb: 0, gainLinear: 1 };
  }
  const intensity = sanitizeRoadLoudnessIntensity(input.intensity);
  const amount = roadLoudnessAmount(input.speedKmh);
  const caps = ROAD_LOUDNESS_CAPS[intensity];
  const gainDb = caps.gainDb * amount;
  const bassDb = caps.bassDb * amount;
  return { gainDb, bassDb, gainLinear: dbToLinear(gainDb) };
}

export interface CalmCabinInput {
  enabled: boolean;
  speedKmh: number;
  userVolume: number;
}

/** Linear bed gain. Always follows speed when enabled; silent at volume 0. */
export function calmCabinGainLinear(input: CalmCabinInput): number {
  if (!input.enabled || input.userVolume <= 0) return 0;
  return CALM_CABIN_MAX_LINEAR * roadLoudnessAmount(input.speedKmh);
}

/** One-pole smoother for GPS speed so the curve does not pump. */
export function smoothRoadSpeedKmh(
  current: number,
  target: number,
  dt: number,
  tau = ROAD_LOUDNESS_TAU_SECONDS,
): number {
  const from = Number.isFinite(current) ? Math.max(0, current) : 0;
  const to = Number.isFinite(target) ? Math.max(0, target) : 0;
  return smoothToward(from, to, dt, tau);
}

/** Signed-in users may use Noise masking for free, permanently. Signed-out users may not. */
export function isNoiseMaskingAllowed(isSignedIn: boolean): boolean {
  return isSignedIn === true;
}

export interface NoiseMaskingAudioInput {
  isSignedIn: boolean;
  /** Master package enable (Drive toggle / Settings heading control). */
  noiseMasking: boolean;
  matchVolumeToSpeed: boolean;
  calmCabin: boolean;
}

/**
 * Effective audio flags. Signed-out visitors always get both off, even if
 * stored settings were left on by a previous signed-in session.
 */
export function effectiveNoiseMaskingAudio(input: NoiseMaskingAudioInput): {
  matchVolumeToSpeed: boolean;
  calmCabin: boolean;
} {
  const on = isNoiseMaskingAllowed(input.isSignedIn) && input.noiseMasking === true;
  return {
    matchVolumeToSpeed: on && input.matchVolumeToSpeed === true,
    calmCabin: on && input.calmCabin === true,
  };
}
