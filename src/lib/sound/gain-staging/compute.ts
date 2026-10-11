import { perceptualVolumeGain } from "@/lib/sound/perceptual-volume";
import {
  MASTER_LOAD_SCALE_FLOOR,
  OUTPUT_BOOST_MAX_DB,
  SAMPLE_PEAK_CEILING_LINEAR,
  USER_STAGE_CEILING,
} from "@/lib/sound/gain-staging/constants";

export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

export function linearToDb(gain: number): number {
  if (gain <= 1e-6) return -120;
  return 20 * Math.log10(gain);
}

export function clampOutputBoostDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(OUTPUT_BOOST_MAX_DB, Math.max(0, db));
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Mild load opening on the master stage. Not real-time AGC — cruise stays audible;
 * combustion/strategy layers carry the main load contrast.
 */
export function mildMasterLoadScale(load: number, regen = 0): number {
  const L = clamp01(load);
  const duck = 1 - clamp01(regen) * 0.12;
  return (MASTER_LOAD_SCALE_FLOOR + L * (1 - MASTER_LOAD_SCALE_FLOOR)) * duck;
}

export interface UserStageGainInput {
  /** Slider 0..1; 0 = silence. */
  uiVolume: number;
  profileGain: number;
  /** Offline PROFILE_LOUDNESS trim. */
  loudnessTrim: number;
  /** 0..OUTPUT_BOOST_MAX_DB. */
  outputBoostDb: number;
  loadScale: number;
  /** Intensity-band ceiling (≤ USER_STAGE_CEILING) applied before boost. */
  intensityCeiling: number;
}

/**
 * Linear gain into the peak-protect stage.
 * Perceptual curve + offline trim + profile balance + mild load, then boost.
 * Zero UI volume is true silence (0), not a denormal floor.
 */
export function computeUserStageLinearGain(input: UserStageGainInput): number {
  const ui = clamp01(input.uiVolume);
  if (ui <= 0) return 0;
  const perceptual = perceptualVolumeGain(ui);
  const profileGain = Math.min(1.6, Math.max(0.2, input.profileGain));
  const trim = Math.min(1.6, Math.max(0.4, input.loudnessTrim));
  const load = Math.min(1.05, Math.max(MASTER_LOAD_SCALE_FLOOR * 0.9, input.loadScale));
  const ceiling = Math.min(USER_STAGE_CEILING, Math.max(0.2, input.intensityCeiling));
  const preBoost = Math.min(ceiling, perceptual * profileGain * trim * load);
  const boost = dbToLinear(clampOutputBoostDb(input.outputBoostDb));
  return preBoost * boost;
}

/** Worst-case estimate for tests: max slider, max boost, max profile gain, loud trim, full load, dual-engine crossfade. */
export function worstCasePreProtectGain(loudnessTrim = 1.18, crossfadeOverlap = Math.SQRT1_2 * 2): number {
  const single = computeUserStageLinearGain({
    uiVolume: 1,
    profileGain: 1.6,
    loudnessTrim,
    outputBoostDb: OUTPUT_BOOST_MAX_DB,
    loadScale: 1,
    intensityCeiling: USER_STAGE_CEILING,
  });
  return single * crossfadeOverlap;
}

export function samplePeakWithinCeiling(peakLinear: number, epsilon = 1e-3): boolean {
  return Number.isFinite(peakLinear) && peakLinear <= SAMPLE_PEAK_CEILING_LINEAR + epsilon;
}
