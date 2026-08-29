import { describe, expect, it } from "vitest";
import {
  runCityStopGoFusionScenario,
  runImuLeadHardTipInScenario,
  runPhoneOverBrowserGpsScenario,
  runTeslaBrowserOnlyScenario,
} from "@/lib/motion/fusion-scenarios";

describe("fusion → powertrain scenarios", () => {
  it("Scenario H: IMU transients appear before GPS speed catches up", () => {
    const result = runImuLeadHardTipInScenario();
    const tipMs = 80 * 0.016 * 1000;
    const duringTip = result.samples.filter((s) => s.tMs >= tipMs && s.tMs <= tipMs + 400);
    const peakAccel = Math.max(...duringTip.map((s) => s.accelMs2));
    const lateSpeed = result.samples.at(-1)?.speedKmh ?? 0;

    expect(peakAccel).toBeGreaterThan(1);
    expect(lateSpeed).toBeGreaterThan(45);
    expect(result.maxRpmJump).toBeLessThan(1200);
    expect(result.maxSpeedJumpKmh).toBeLessThan(6);
  });

  it("Scenario I: city stop-go stays physically plausible", () => {
    const result = runCityStopGoFusionScenario();
    for (const sample of result.samples) {
      expect(sample.speedKmh).toBeGreaterThanOrEqual(0);
      expect(sample.speedKmh).toBeLessThan(95);
      expect(sample.rpm).toBeGreaterThan(0);
      expect(sample.rpm).toBeLessThan(7800);
    }
    expect(result.maxRpmJump).toBeLessThan(1100);
    expect(result.maxSpeedJumpKmh).toBeLessThan(7);
  });

  it("Scenario J: Tesla browser-only fusion drives powertrain", () => {
    const result = runTeslaBrowserOnlyScenario();
    expect(result.samples.at(-1)?.speedKmh ?? 0).toBeGreaterThan(70);
    expect(result.samples.some((s) => s.accelMs2 > 0.25)).toBe(true);
    expect(result.maxRpmJump).toBeLessThan(1000);
  });

  it("Scenario K: phone GPS overrides browser GPS for speed baseline", () => {
    const result = runPhoneOverBrowserGpsScenario();
    expect(result.samples.at(-1)?.speedKmh ?? 0).toBeGreaterThan(55);
    expect(result.maxSpeedJumpKmh).toBeLessThan(5);
  });
});
