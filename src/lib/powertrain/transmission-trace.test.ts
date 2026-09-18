import { describe, expect, it } from "vitest";
import {
  POWERTRAIN_SCENARIOS,
  runPowertrainScenario,
  validatePowertrainTrace,
  verifyUpshiftRpmDrops,
} from "@/lib/powertrain/scenarios";
import { DRIVETRAIN_PERSONALITY_IDS } from "@/lib/drive/drivetrain-personalities";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmAfterGearChange, rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";
import {
  beginShift,
  createShiftControllerState,
  tickShift,
} from "@/lib/powertrain/shift-controller";

const profile = getPowertrainProfile("gt-v8");

describe("scenario traces", () => {
  for (const scenario of POWERTRAIN_SCENARIOS) {
    it(`${scenario.label} - no hunting or impossible shifts`, () => {
      const result = runPowertrainScenario(scenario);
      const p = getPowertrainProfile(result.profileId);
      const validation = validatePowertrainTrace(result, p);
      if (!validation.ok) {
        expect(validation.issues).toEqual([]);
      }
      expect(validation.ok).toBe(true);
      expect(result.samples.length).toBeGreaterThan(10);
    });

    it(`${scenario.label} - upshifts drop RPM from ratios`, () => {
      const result = runPowertrainScenario(scenario);
      const drops = verifyUpshiftRpmDrops(result);
      if (drops.length > 0) {
        expect(drops).toEqual([]);
      }
      expect(drops.length).toBe(0);
    });
  }
});

describe("cross-profile transmission traces", () => {
  const hardScenario = POWERTRAIN_SCENARIOS.find((s) => s.id === "hard-0-100")!;

  for (const profileId of DRIVETRAIN_PERSONALITY_IDS) {
    it(`${profileId} - hard 0–100 passes trace validation`, () => {
      const p = getPowertrainProfile(profileId);
      const result = runPowertrainScenario({ ...hardScenario, profileId }, p);
      const validation = validatePowertrainTrace(result, p);
      expect(validation.ok, validation.issues.join("; ")).toBe(true);
    });
  }
});

describe("hard 0–100", () => {
  it("reaches high gear and multiple shifts", () => {
    const scenario = POWERTRAIN_SCENARIOS.find((s) => s.id === "hard-0-100")!;
    const result = runPowertrainScenario(scenario);
    const last = result.samples[result.samples.length - 1]!;
    expect(last.speedKmh).toBeGreaterThan(80);
    expect(result.shiftCount).toBeGreaterThan(2);
    expect(last.gear).toBeGreaterThan(3);
  });
});

describe("stop-and-go", () => {
  it("returns to neutral at stop", () => {
    const scenario = POWERTRAIN_SCENARIOS.find((s) => s.id === "stop-and-go")!;
    const result = runPowertrainScenario(scenario);
    const neutrals = result.samples.filter((s) => s.gear === 0);
    expect(neutrals.length).toBeGreaterThan(0);
  });
});

describe("upshift RPM drop", () => {
  it("completes with lower RPM from gear ratios", () => {
    const speed = 95;
    const { before, after } = rpmAfterGearChange(speed, 2, 3, profile);
    let state = beginShift(createShiftControllerState(), "up", 2, 3, speed, before, profile);
    let rpm = before;
    let completed = false;
    for (let i = 0; i < 200; i += 1) {
      const step = tickShift(state, 0.016, profile);
      state = step.state;
      rpm = step.rpm;
      if (step.complete) {
        completed = true;
        break;
      }
    }
    expect(completed).toBe(true);
    expect(rpm).toBeLessThan(before);
    expect(rpm).toBeCloseTo(after, -1);
  });
});

describe("rev-match downshift", () => {
  it("raises RPM during flare before settling", () => {
    const speed = 60;
    const before = rpmFromSpeedAndGear(speed, 3, profile);
    let state = beginShift(createShiftControllerState(), "down", 3, 2, speed, before, profile);
    expect(state.revMatchActive).toBe(true);
    let peak = before;
    for (let i = 0; i < 6; i += 1) {
      const step = tickShift(state, 0.016, profile);
      state = step.state;
      peak = Math.max(peak, step.rpm);
    }
    expect(peak).toBeGreaterThan(before * 1.01);
  });
});
