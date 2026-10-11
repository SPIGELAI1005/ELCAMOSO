/**
 * Perceptual volume mapping for the Drive / Settings volume slider.
 *
 * UI 0..1 maps to an acoustic gain factor that feels closer to:
 * 20% quiet · 35% new-device default · 40% clearly audible · 60% normal ·
 * 70% strong normal · 85% loud · 100% max.
 *
 * Pure linear UI→gain under-powers mid settings in a Tesla cabin.
 * Gain staging ownership: see `src/lib/sound/gain-staging/` and
 * `docs/audio/GAIN_STAGING.md` (Prompt 08).
 */

import { MASTER_BUS_OUTPUT_GAIN } from "@/lib/sound/gain-staging/constants";
import { mildMasterLoadScale } from "@/lib/sound/gain-staging/compute";

const ANCHORS: ReadonlyArray<{ ui: number; gain: number }> = [
  { ui: 0, gain: 0 },
  { ui: 0.2, gain: 0.18 },
  { ui: 0.35, gain: 0.34 },
  { ui: 0.4, gain: 0.42 },
  { ui: 0.6, gain: 0.68 },
  { ui: 0.7, gain: 0.82 },
  { ui: 0.85, gain: 0.94 },
  { ui: 1, gain: 1 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map slider position (0..1) to perceptual linear gain (0..1). Zero → silence. */
export function perceptualVolumeGain(uiVolume: number): number {
  const v = Math.min(1, Math.max(0, uiVolume));
  if (v <= 0) return 0;
  for (let i = 0; i < ANCHORS.length - 1; i += 1) {
    const a = ANCHORS[i]!;
    const b = ANCHORS[i + 1]!;
    if (v <= b.ui) {
      const t = (v - a.ui) / Math.max(0.0001, b.ui - a.ui);
      return lerp(a.gain, b.gain, t);
    }
  }
  return 1;
}

/**
 * Approximate dB relative to full scale for a linear gain (reference 1.0 = 0 dB).
 * Used in diagnostics / tests only.
 */
export function gainToDb(gain: number): number {
  if (gain <= 0.0001) return -80;
  return 20 * Math.log10(gain);
}

/** @deprecated Prefer import from gain-staging; kept for existing importers. */
export { MASTER_BUS_OUTPUT_GAIN };

/**
 * Soft-start / profile-switch ramp — close to full so Tesla cabin is audible
 * immediately; sensor source must not dictate engine loudness.
 */
export const STARTUP_VOLUME_SCALE = 0.92;

/** Profile-gain ramp after a personality switch (was an extra 0.8× cut). */
export const PROFILE_SWITCH_VOLUME_SCALE = 1;

/**
 * @deprecated Use mildMasterLoadScale from gain-staging (Prompt 08).
 * Kept as a thin wrapper so older call sites keep compiling during migration.
 */
export function loadAwareMasterScale(load: number, regen = 0): number {
  return mildMasterLoadScale(load, regen);
}
