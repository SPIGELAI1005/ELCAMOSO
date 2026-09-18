import { describe, expect, it } from "vitest";
import { DRIVETRAIN_PERSONALITY_IDS } from "@/lib/drive/drivetrain-personalities";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  calibrationUpshiftTable,
  resolveShiftMap,
  validateShiftMap,
} from "@/lib/powertrain/shift-map";
import {
  getPowertrainScenario,
  runPowertrainScenario,
  validatePowertrainTrace,
} from "@/lib/powertrain/scenarios";
import { cappedGain, BAND_CEILING, intensityCeiling } from "@/lib/drive/safety";
import { getProfile } from "@/lib/sound/profiles";
import {
  gainToDb,
  loadAwareMasterScale,
  MASTER_BUS_OUTPUT_GAIN,
  perceptualVolumeGain,
  STARTUP_VOLUME_SCALE,
} from "@/lib/sound/perceptual-volume";
import { loudnessForProfile } from "@/lib/sound/realism/loudness";

/** Previous Flat-Six Sport 1→2 schedule (Road Feel V2) for regression contrast. */
const PREV_FLAT_SIX_1_2 = { 0.1: 42.9, 0.25: 51.7, 0.5: 67.2, 0.75: 79.5, 1: 85.2 };
/** Previous Turbo Inline-6 1→2 schedule (Road Feel V2). */
const PREV_TURBO_I6_1_2 = { 0.1: 38.6, 0.25: 48.4, 0.5: 65.9, 0.75: 79.2, 1: 83.0 };

describe("Road Feel V3 shift map targets", () => {
  it("Flat-Six 1→2 lands in product bands under light/normal demand", () => {
    const table = calibrationUpshiftTable(getPowertrainProfile("flat-six-sport"));
    const byDemand = Object.fromEntries(table.map((r) => [r.demand, r.speeds[0]!]));
    expect(byDemand[0.1]!).toBeGreaterThanOrEqual(24);
    expect(byDemand[0.1]!).toBeLessThanOrEqual(29);
    expect(byDemand[0.25]!).toBeGreaterThanOrEqual(28);
    expect(byDemand[0.25]!).toBeLessThanOrEqual(34);
    expect(byDemand[0.5]!).toBeGreaterThanOrEqual(36);
    expect(byDemand[0.5]!).toBeLessThanOrEqual(46);
    // Must be clearly earlier than the V2 tall schedule that failed on-road.
    expect(byDemand[0.1]!).toBeLessThan(PREV_FLAT_SIX_1_2[0.1]! - 10);
    expect(byDemand[0.25]!).toBeLessThan(PREV_FLAT_SIX_1_2[0.25]! - 12);
  });

  it("Turbo Inline-6 1→2 is earlier than V2 and midrange-friendly", () => {
    const table = calibrationUpshiftTable(getPowertrainProfile("turbo-inline-6"));
    const byDemand = Object.fromEntries(table.map((r) => [r.demand, r.speeds[0]!]));
    expect(byDemand[0.1]!).toBeGreaterThanOrEqual(23);
    expect(byDemand[0.1]!).toBeLessThanOrEqual(29);
    expect(byDemand[0.25]!).toBeGreaterThanOrEqual(27);
    expect(byDemand[0.25]!).toBeLessThanOrEqual(34);
    expect(byDemand[0.1]!).toBeLessThan(PREV_TURBO_I6_1_2[0.1]! - 8);
  });

  it("keeps personality differentiation under light demand", () => {
    const am = resolveShiftMap(getPowertrainProfile("american-v8")).upshiftSpeedKmh[0]![1]!;
    const fs = resolveShiftMap(getPowertrainProfile("flat-six-sport")).upshiftSpeedKmh[0]![1]!;
    const moto = resolveShiftMap(getPowertrainProfile("motorcycle-inline-4"))
      .upshiftSpeedKmh[0]![1]!;
    expect(am).toBeLessThan(fs);
    expect(moto).toBeGreaterThan(fs * 2);
  });

  it("validates every personality map after Road Feel V3", () => {
    for (const id of DRIVETRAIN_PERSONALITY_IDS) {
      const profile = getPowertrainProfile(id);
      const validation = validateShiftMap(resolveShiftMap(profile), profile);
      expect(validation.ok, `${id}: ${validation.issues.join("; ")}`).toBe(true);
    }
  });
});

describe("Road Feel V3 shift scenarios", () => {
  it("gentle 0–60 (flat-six city): 1→2 near ~30 km/h", () => {
    const scenario = getPowertrainScenario("gentle-city")!;
    const result = runPowertrainScenario(scenario);
    const profile = getPowertrainProfile(result.profileId);
    expect(validatePowertrainTrace(result, profile).ok).toBe(true);
    const firstUp = result.gearChanges.find((c) => c.from === 1 && c.to === 2);
    expect(firstUp).toBeTruthy();
    const sample = result.samples.find((s) => s.tMs === firstUp!.atMs);
    expect(sample!.speedKmh).toBeGreaterThanOrEqual(24);
    // Decision-speed lag under acceleration allows a few km/h of overshoot past the map.
    expect(sample!.speedKmh).toBeLessThanOrEqual(46);
  });

  it("normal 0–100 produces several clearly separated upshifts", () => {
    const result = runPowertrainScenario(getPowertrainScenario("medium-0-100")!);
    const ups = result.gearChanges.filter((c) => c.to === c.from + 1 && c.from > 0);
    expect(ups.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < ups.length; i += 1) {
      expect(ups[i]!.atMs - ups[i - 1]!.atMs).toBeGreaterThan(250);
    }
  });

  it("hard 0–140 holds gears longer than gentle city", () => {
    const gentle = runPowertrainScenario(getPowertrainScenario("gentle-city")!);
    const hard = runPowertrainScenario(getPowertrainScenario("hard-0-140")!);
    const g1 = gentle.gearChanges.find((c) => c.from === 1 && c.to === 2);
    const h1 = hard.gearChanges.find((c) => c.from === 1 && c.to === 2);
    expect(g1 && h1).toBeTruthy();
    const gSpeed = gentle.samples.find((s) => s.tMs === g1!.atMs)!.speedKmh;
    const hSpeed = hard.samples.find((s) => s.tMs === h1!.atMs)!.speedKmh;
    expect(hSpeed).toBeGreaterThan(gSpeed + 8);
  });

  it.each(["cruise-30", "cruise-50", "cruise-80", "cruise-100", "cruise-120"] as const)(
    "%s stays stable without hunting",
    (id) => {
      const result = runPowertrainScenario(getPowertrainScenario(id)!);
      const profile = getPowertrainProfile(result.profileId);
      expect(validatePowertrainTrace(result, profile).ok).toBe(true);
      const engaged = result.samples.filter((s) => s.gear > 0 && s.tMs > 3500);
      expect(new Set(engaged.map((s) => s.gear)).size).toBeLessThanOrEqual(2);
    },
  );

  it("GPS jitter cruise does not hunt", () => {
    const result = runPowertrainScenario(getPowertrainScenario("gps-jitter-cruise")!);
    const profile = getPowertrainProfile(result.profileId);
    expect(validatePowertrainTrace(result, profile).ok).toBe(true);
    const engaged = result.samples.filter((s) => s.tMs > 2000);
    expect(new Set(engaged.map((s) => s.gear)).size).toBeLessThanOrEqual(2);
  });

  it("source transition does not invent a gear change", () => {
    const result = runPowertrainScenario(getPowertrainScenario("source-transition")!);
    const around = result.gearChanges.filter((c) => c.atMs >= 190 * 16 && c.atMs <= 250 * 16);
    expect(around.length).toBe(0);
  });
});

describe("Road Feel V3 gain staging", () => {
  it("maps perceptual slider anchors", () => {
    expect(perceptualVolumeGain(0.2)).toBeCloseTo(0.18, 2);
    expect(perceptualVolumeGain(0.4)).toBeCloseTo(0.42, 2);
    expect(perceptualVolumeGain(0.6)).toBeCloseTo(0.68, 2);
    expect(perceptualVolumeGain(0.7)).toBeCloseTo(0.82, 2);
    expect(perceptualVolumeGain(1)).toBe(1);
  });

  it("keeps cabin volume at 0.7 clearly above the old linear×0.55×0.72 path", () => {
    const profile = getProfile("flat-six-sport");
    const after = cappedGain(0.7, 1, profile);
    const loadScale = loadAwareMasterScale(0.12);
    const trim = loudnessForProfile(profile.id);
    const effective =
      Math.min(0.85, after * trim * loadScale) * MASTER_BUS_OUTPUT_GAIN * STARTUP_VOLUME_SCALE;

    // Legacy approx: 0.7 * 0.55 * 0.96 * 0.72 ≈ 0.27
    const legacyApprox = 0.7 * 0.55 * 0.96 * 0.72;
    expect(effective).toBeGreaterThan(legacyApprox * 1.6);
    expect(gainToDb(effective) - gainToDb(legacyApprox)).toBeGreaterThan(3);
  });

  it("does not exceed safety ceilings at full volume", () => {
    const profile = getProfile("flat-six-sport");
    const gain = cappedGain(1, 1, profile);
    expect(gain).toBeLessThanOrEqual(intensityCeiling(profile) + 0.001);
    expect(gain * loudnessForProfile(profile.id)).toBeLessThanOrEqual(0.95);
    expect(BAND_CEILING.intense).toBeLessThan(BAND_CEILING.gentle);
  });

  it("keeps GT V8 and Flat-Six within a modest loudness trim delta", () => {
    const gt = loudnessForProfile("gt-v8");
    const fs = loudnessForProfile("flat-six-sport");
    expect(Math.abs(gt - fs)).toBeLessThan(0.08);
  });
});
