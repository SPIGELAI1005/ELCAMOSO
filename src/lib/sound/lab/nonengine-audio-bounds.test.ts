/**
 * Offline render test for non-engine sound profiles.
 *
 * NOTE: This test suite requires OfflineAudioContext which is not available in
 * Node.js. It runs in browser environments (Vitest with browser mode, Playwright,
 * or manual execution). When running under `npm test` with vitest's default node
 * environment, all tests are skipped.
 *
 * To run these tests:
 * - Use vitest with browser mode: `npx vitest --browser.enabled`
 * - Or run in a Playwright test: see scripts/render-audio-lab.mjs
 *
 * Validates:
 * 1. Loudness is within -20 to -12 LUFS (approximate integrated)
 * 2. Low-frequency energy share (<60 Hz) is below 30% of total energy
 * 3. Sample peak is below -0.5 dBFS (headroom for true peak)
 * 4. Idle presence: RMS > -50 dBFS at standstill
 */

import { describe, expect, it } from "vitest";
import { renderLabOffline } from "@/lib/sound/lab/render-harness";

const OfflineCtx =
  globalThis.OfflineAudioContext ??
  (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
    .webkitOfflineAudioContext;

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
  "deep-bass-pulse",
  "thunder-beast",
  "laughing-machine",
  "farting-car",
  "wild-west-carriage",
  "romanian-85-carriage",
  "horse-gallop",
  "wiesn-tractor",
];

const LOUDNESS_MIN_LUFS = -20;
const LOUDNESS_MAX_LUFS = -12;
const LF_SHARE_MAX_PERCENT = 30;
const PEAK_MAX_DBFS = -0.5;

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

describe.skipIf(!OfflineCtx)("non-engine audio bounds", () => {
  it.each(NON_ENGINE_PROFILES)(
    "%s meets loudness and LF share bounds (steady-80 fixture)",
    async (profileId) => {
      const result = await renderLabOffline({
        profileId,
        fixtureId: "steady-80",
        includeSpectrum: false,
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
      });

      const { metrics } = result;

      expect(metrics.rmsDbfs).toBeGreaterThan(-50);
    },
    60_000,
  );
});
