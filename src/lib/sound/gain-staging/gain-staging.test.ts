import { describe, expect, it } from "vitest";
import { getProfile } from "@/lib/sound/profiles";
import { BAND_CEILING, intensityCeiling } from "@/lib/drive/safety";
import { sanitizeSettings, DEFAULT_SETTINGS, parseBackup } from "@/lib/drive/settings";
import { perceptualVolumeGain } from "@/lib/sound/perceptual-volume";
import {
  DEFAULT_UI_VOLUME,
  OUTPUT_BOOST_MAX_DB,
  SAMPLE_PEAK_CEILING_DBFS,
  SAMPLE_PEAK_CEILING_LINEAR,
  USER_STAGE_CEILING,
  clampOutputBoostDb,
  computeUserStageLinearGain,
  dbToLinear,
  makeSamplePeakCeilingCurve,
  mildMasterLoadScale,
  samplePeakWithinCeiling,
  worstCasePreProtectGain,
} from "@/lib/sound/gain-staging";

describe("Prompt 08 gain staging", () => {
  it("maps zero UI volume to silence and default near 35%", () => {
    expect(DEFAULT_UI_VOLUME).toBe(0.35);
    expect(DEFAULT_SETTINGS.volume).toBe(0.35);
    expect(perceptualVolumeGain(0)).toBe(0);
    expect(computeUserStageLinearGain({
      uiVolume: 0,
      profileGain: 1.6,
      loudnessTrim: 1.2,
      outputBoostDb: 6,
      loadScale: 1,
      intensityCeiling: USER_STAGE_CEILING,
    })).toBe(0);
    expect(perceptualVolumeGain(0.35)).toBeCloseTo(0.34, 2);
  });

  it("applies perceptual curve before profile gain and offline trim", () => {
    const ui = 0.5;
    const g = computeUserStageLinearGain({
      uiVolume: ui,
      profileGain: 1.2,
      loudnessTrim: 1.1,
      outputBoostDb: 0,
      loadScale: 1,
      intensityCeiling: USER_STAGE_CEILING,
    });
    expect(g).toBeCloseTo(perceptualVolumeGain(ui) * 1.2 * 1.1, 5);
    expect(g).toBeLessThanOrEqual(USER_STAGE_CEILING);
  });

  it("keeps boost after the intensity ceiling (separate stage in the engine)", () => {
    const pre = computeUserStageLinearGain({
      uiVolume: 1,
      profileGain: 1,
      loudnessTrim: 1,
      outputBoostDb: 0,
      loadScale: 1,
      intensityCeiling: 0.7,
    });
    expect(pre).toBeCloseTo(0.7, 5);
    expect(clampOutputBoostDb(9)).toBe(OUTPUT_BOOST_MAX_DB);
    expect(dbToLinear(OUTPUT_BOOST_MAX_DB)).toBeCloseTo(2, 2);
  });

  it("uses a mild master load scale (not AGC)", () => {
    expect(mildMasterLoadScale(0)).toBeGreaterThan(0.9);
    expect(mildMasterLoadScale(1)).toBeCloseTo(1, 3);
    expect(mildMasterLoadScale(0.5, 1)).toBeLessThan(mildMasterLoadScale(0.5, 0));
  });

  it("declares −1 dBFS sample-peak ceiling and soft-knee curve stays within it", () => {
    expect(SAMPLE_PEAK_CEILING_DBFS).toBe(-1);
    expect(SAMPLE_PEAK_CEILING_LINEAR).toBeCloseTo(10 ** (-1 / 20), 5);
    const curve = makeSamplePeakCeilingCurve();
    let max = 0;
    for (let i = 0; i < curve.length; i += 1) max = Math.max(max, Math.abs(curve[i]!));
    expect(max).toBeLessThanOrEqual(SAMPLE_PEAK_CEILING_LINEAR + 1e-6);
    expect(samplePeakWithinCeiling(SAMPLE_PEAK_CEILING_LINEAR)).toBe(true);
  });

  it("keeps worst-case pre-protect gain finite with boost and crossfade overlap", () => {
    const worst = worstCasePreProtectGain(1.18, Math.SQRT1_2 * 2);
    expect(Number.isFinite(worst)).toBe(true);
    expect(worst).toBeGreaterThan(0);
    // Peak protect must absorb this; we only require finiteness + reasonableness.
    expect(worst).toBeLessThan(4);
  });

  it("preserves intensity-band ceiling table", () => {
    expect(BAND_CEILING.intense).toBe(0.7);
    expect(BAND_CEILING.balanced).toBe(0.82);
    expect(BAND_CEILING.gentle).toBe(USER_STAGE_CEILING);
    expect(intensityCeiling(getProfile("zen-drive"))).toBeLessThanOrEqual(USER_STAGE_CEILING);
    expect(intensityCeiling(getProfile("gt-v8"))).toBeLessThanOrEqual(USER_STAGE_CEILING);
  });

  it("migrates v8 backups without rewriting saved volume", () => {
    const raw = JSON.stringify({
      kind: "elcamoso.settings.backup",
      version: 8,
      settings: {
        profileId: "gt-v8",
        volume: 0.62,
        dynamicDrive: true,
      },
    });
    const { settings, report } = parseBackup(raw);
    expect(settings.volume).toBeCloseTo(0.62, 5);
    expect(settings.outputBoostDb).toBe(0);
    expect(settings.bodyCharacter).toBe(0.5);
    expect(settings.mechanicalCharacter).toBe(0.5);
    expect(report.migrations.some((m) => /boost|character/i.test(m))).toBe(true);
  });

  it("sanitizes malformed boost and character preferences", () => {
    const { settings } = sanitizeSettings({
      volume: 2,
      outputBoostDb: 99,
      bodyCharacter: -1,
      mechanicalCharacter: "loud",
    });
    expect(settings.volume).toBe(1);
    expect(settings.outputBoostDb).toBe(6);
    expect(settings.bodyCharacter).toBe(0);
    expect(settings.mechanicalCharacter).toBe(0.5);
  });
});
