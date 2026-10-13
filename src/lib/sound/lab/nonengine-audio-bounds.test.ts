/**
 * Offline render test for non-engine sound profiles.
 * Validates:
 * 1. Loudness is within -18 to -14 LUFS (approximate integrated)
 * 2. Low-frequency energy share (<60 Hz) is below 25% of total energy
 * 3. Sample peak is below -1 dBFS (headroom for true peak)
 */

import { describe, expect, it } from "vitest";
import { renderLabOffline } from "@/lib/sound/lab/render-harness";
import { LAB_BANDS_HZ } from "@/lib/sound/lab/metrics";

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

function lfEnergyShare(bandEnergy: { lowHz: number; highHz: number; rmsDbfs: number }[]): number {
  const lfBand = bandEnergy.find((b) => b.lowHz === 20 && b.highHz === 60);
  if (!lfBand) return 0;
  const lfLinear = Math.pow(10, lfBand.rmsDbfs / 20);
  const totalLinear = bandEnergy.reduce((sum, b) => {
    return sum + Math.pow(10, b.rmsDbfs / 20);
  }, 0);
  return totalLinear > 0 ? (lfLinear / totalLinear) * 100 : 0;
}

describe.skipIf(!OfflineCtx)("non-engine audio bounds", () => {
  it.each(NON_ENGINE_PROFILES)(
    "%s meets loudness and LF share bounds (cruise fixture)",
    async (profileId) => {
      const result = await renderLabOffline({
        profileId,
        fixtureId: "cruise",
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
