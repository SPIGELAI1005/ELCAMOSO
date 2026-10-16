/**
 * Offline render test for non-engine sound profiles.
 *
 * Runs under vitest's node environment via the node-web-audio-api polyfill
 * (src/test-utils/install-web-audio.ts). It must never be silently skipped: if
 * no OfflineAudioContext is available the suite fails.
 *
 * Renders use environmentId "open" (the in-car condition) and validate:
 * 1. Loudness is within LOUDNESS_MIN_LUFS..LOUDNESS_MAX_LUFS (approximate integrated)
 * 2. Low-frequency energy share (<60 Hz) stays below LF_SHARE_MAX_PERCENT
 * 3. Sample peak is below -1 dBFS
 * 4. Idle presence: RMS > -50 dBFS at standstill
 */

import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";
import { renderLabOffline } from "@/lib/sound/lab/render-harness";

const NON_ENGINE_PROFILES = [
  "open-wind",
  "storm-glider",
  "rain-drive",
  "ocean-drive",
  "zen-drive",
  "space-ship",
  "helicopter",
  "maglev-train",
  "synthwave-drive",
  "retro-arcade",
  "heartbeat",
  "rocket-car",
  "deep-bass-pulse",
  "thunder-beast",
  "laughing-machine",
  "farting-car",
  "wild-west-carriage",
  "romanian-85-carriage",
  "horse-gallop",
  "wiesn-tractor",
];

// steady-80 is a 10 s constant cruise (no throttle events), so event-driven sounds
// (laughs, pulses, growls) sit below their full-drive -16 LUFS integrated level.
// This band catches gross regressions (silence, runaway gain); the -16 ±2 LUFS
// catalog target is verified on the full drive render (see loudness.ts).
const LOUDNESS_MIN_LUFS = -24;
const LOUDNESS_MAX_LUFS = -9;
const LF_SHARE_MAX_PERCENT = 30;
// Peak-protect ceiling is -1 dBFS; allow float rounding at the ceiling.
const PEAK_MAX_DBFS = -0.99;

/**
 * Calculate low-frequency energy share using energy (amplitude squared),
 * not amplitude sum, for accurate spectral analysis.
 */
function lfEnergyShare(bandEnergy: { lowHz: number; highHz: number; rmsDbfs: number }[]): number {
  const lfBand = bandEnergy.find((b) => b.lowHz === 20 && b.highHz === 60);
  if (!lfBand) return 0;
  const lfEnergy = Math.pow(10, lfBand.rmsDbfs / 10);
  const totalEnergy = bandEnergy.reduce((sum, b) => {
    return sum + Math.pow(10, b.rmsDbfs / 10);
  }, 0);
  return totalEnergy > 0 ? (lfEnergy / totalEnergy) * 100 : 0;
}

describe("non-engine audio bounds", () => {
  it("has an OfflineAudioContext (polyfilled in node)", () => {
    expect(typeof globalThis.OfflineAudioContext).toBe("function");
  });

  it.each(NON_ENGINE_PROFILES)(
    "%s meets loudness and LF share bounds (steady-80 fixture)",
    async (profileId) => {
      const result = await renderLabOffline({
        profileId,
        fixtureId: "steady-80",
        includeSpectrum: false,
        environmentId: "open",
      });

      const { metrics } = result;

      expect(metrics.nanCount).toBe(0);
      expect(metrics.infinityCount).toBe(0);

      expect(metrics.approximateIntegratedLoudness).toBeGreaterThanOrEqual(LOUDNESS_MIN_LUFS);
      expect(metrics.approximateIntegratedLoudness).toBeLessThanOrEqual(LOUDNESS_MAX_LUFS);

      expect(metrics.samplePeakDbfs).toBeLessThanOrEqual(PEAK_MAX_DBFS);

      const lfShare = lfEnergyShare(metrics.bandEnergy);
      expect(lfShare).toBeLessThanOrEqual(LF_SHARE_MAX_PERCENT);
    },
    90_000,
  );

  it.each(NON_ENGINE_PROFILES)(
    "%s has audible idle presence (idle fixture)",
    async (profileId) => {
      const result = await renderLabOffline({
        profileId,
        fixtureId: "idle",
        includeSpectrum: false,
        environmentId: "open",
      });

      const { metrics } = result;

      expect(metrics.rmsDbfs).toBeGreaterThan(-50);
    },
    60_000,
  );
});
