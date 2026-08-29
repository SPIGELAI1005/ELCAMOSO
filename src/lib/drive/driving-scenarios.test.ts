import { describe, expect, it } from "vitest";
import {
  ALL_DRIVING_SCENARIO_IDS,
  assertFusionScenarioPlausibility,
  DRIVING_SCENARIOS,
  runAllDrivingScenarios,
  runDrivingScenario,
  runDrivingScenarioById,
  runPhoneSensorLossScenario,
  runTelemetryReconnectScenario,
} from "@/lib/drive/driving-scenarios";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  assertPhysicalPlausibility,
  findFirstUpshiftMs,
  verifyUpshiftRpmDrops,
} from "@/lib/powertrain/scenarios";

const DT = 0.016;

function expectScenarioPlausible(result: ReturnType<typeof runDrivingScenario>) {
  const profile = getPowertrainProfile(result.profileId);
  const plausibility = assertPhysicalPlausibility(result, profile);
  if (!plausibility.ok) {
    expect(plausibility.issues, plausibility.issues.join("; ")).toEqual([]);
  }
  expect(plausibility.ok).toBe(true);
}

function expectFusionPlausible(result: ReturnType<typeof runPhoneSensorLossScenario>) {
  const plausibility = assertFusionScenarioPlausibility(result);
  if (!plausibility.ok) {
    expect(plausibility.issues, plausibility.issues.join("; ")).toEqual([]);
  }
  expect(plausibility.ok).toBe(true);
}

describe("automated driving scenarios", () => {
  describe("Scenario A: 0→100 full acceleration", () => {
    it("performs multiple upshifts with coherent RPM drops", () => {
      const result = runDrivingScenario("scenario-a");
      expectScenarioPlausible(result);

      const last = result.samples.at(-1)!;
      expect(last.speedKmh).toBeGreaterThan(90);
      expect(result.shiftCount).toBeGreaterThanOrEqual(3);

      const rpmDropIssues = verifyUpshiftRpmDrops(result);
      expect(rpmDropIssues, rpmDropIssues.join("; ")).toEqual([]);
    });
  });

  describe("Scenario B: 0→80 gentle acceleration", () => {
    it("shifts at lower speed than full-throttle acceleration", () => {
      const gentle = runDrivingScenario("scenario-b");
      const hard = runDrivingScenario("scenario-a");
      expectScenarioPlausible(gentle);

      const gentleFirst = findFirstUpshiftMs(gentle);
      const hardFirst = findFirstUpshiftMs(hard);
      expect(gentleFirst).not.toBeNull();
      expect(hardFirst).not.toBeNull();

      const gentleSpeedAtShift = gentle.samples.find(
        (sample) => sample.tMs >= gentleFirst!,
      )?.speedKmh;
      const hardSpeedAtShift = hard.samples.find((sample) => sample.tMs >= hardFirst!)?.speedKmh;
      expect(gentleSpeedAtShift ?? Infinity).toBeLessThan(hardSpeedAtShift ?? 0);
      expect(gentle.samples.filter((sample) => sample.gear > 1).length).toBeGreaterThan(0);
    });
  });

  describe("Scenario C: 80 km/h cruise → hard acceleration", () => {
    it("triggers kickdown with a downshift", () => {
      const result = runDrivingScenario("scenario-c");
      expectScenarioPlausible(result);

      const cruiseEndMs = 980 * DT * 1000;
      const kickdownChanges = result.gearChanges.filter(
        (change) => change.atMs >= cruiseEndMs && change.to < change.from && change.from > 0,
      );
      const kickdownTargets = result.samples.filter(
        (sample) => sample.tMs >= cruiseEndMs && sample.targetGear < sample.gear && sample.gear > 1,
      );
      expect(kickdownChanges.length + kickdownTargets.length).toBeGreaterThan(0);

      const kickdownModes = result.samples
        .filter((sample) => sample.tMs >= cruiseEndMs)
        .map((sample) => sample.drivingMode);
      expect(
        kickdownModes.some(
          (mode) => mode === "acceleration" || mode === "hard-acceleration" || mode === "shift",
        ),
      ).toBe(true);
    });
  });

  describe("Scenario D: 120→60 braking", () => {
    it("downshifts progressively with optional rev matching", () => {
      const result = runDrivingScenario("scenario-d");
      expectScenarioPlausible(result);

      const last = result.samples.at(-1)!;
      expect(last.speedKmh).toBeLessThan(75);
      expect(last.speedKmh).toBeGreaterThan(35);

      const downshifts = result.gearChanges.filter(
        (change) => change.from > 0 && change.to > 0 && change.to < change.from,
      );
      expect(downshifts.length).toBeGreaterThanOrEqual(1);

      const revMatchFrames = result.samples.filter((sample) => sample.revMatchActive);
      expect(revMatchFrames.length).toBeGreaterThan(0);
    });
  });

  describe("Scenario E: 100 km/h lift throttle", () => {
    it("enters overrun after lift-off", () => {
      const result = runDrivingScenario("scenario-e");
      expectScenarioPlausible(result);

      const liftMs = 260 * 0.016 * 1000;
      const afterLift = result.samples.filter((sample) => sample.tMs >= liftMs);
      expect(afterLift.some((sample) => sample.overrun || sample.drivingMode === "overrun")).toBe(
        true,
      );
    });
  });

  describe("Scenario F: phone sensor stops for 3 seconds", () => {
    it("falls back gracefully without implausible motion", () => {
      const result = runPhoneSensorLossScenario();
      expectFusionPlausible(result);

      const gapStartMs = 2200;
      const gapSamples = result.samples.filter((sample) => sample.tMs >= gapStartMs);

      expect(gapSamples.length).toBeGreaterThan(150);
      expect(gapSamples.some((sample) => sample.fallbackTier === "hold")).toBe(true);
      expect(gapSamples.at(-1)?.speedKmh ?? 0).toBeGreaterThan(55);
      expect(result.maxSpeedJumpKmh).toBeLessThan(8);
      expect(result.maxRpmJump).toBeLessThan(900);
    });
  });

  describe("Scenario G: telemetry reconnects after stale data", () => {
    it("corrects smoothly without an RPM jump", () => {
      const result = runTelemetryReconnectScenario();
      expectFusionPlausible(result);

      expect(result.samples.length).toBeGreaterThan(10);
      expect(result.maxRpmJump).toBeLessThan(900);
      expect(result.maxSpeedJumpKmh).toBeLessThan(4.5);
      expect(result.samples.at(-1)?.speedKmh ?? 0).toBeGreaterThan(52);
    });
  });

  it("registers all deterministic scenario definitions A–E", () => {
    expect(DRIVING_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "scenario-a",
      "scenario-b",
      "scenario-c",
      "scenario-d",
      "scenario-e",
    ]);
  });

  it("runs the full A–G suite without physical implausibility", () => {
    const results = runAllDrivingScenarios();
    expect(results).toHaveLength(ALL_DRIVING_SCENARIO_IDS.length);

    for (const result of results) {
      if ("maxSpeedJumpKmh" in result) {
        expectFusionPlausible(result);
      } else {
        expectScenarioPlausible(result);
      }
    }
  });

  it("dispatches scenarios by id through runDrivingScenarioById", () => {
    for (const id of ALL_DRIVING_SCENARIO_IDS) {
      const result = runDrivingScenarioById(id);
      expect(result.scenarioId).toBe(id);
    }
  });
});
