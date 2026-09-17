import { describe, expect, it } from "vitest";
import {
  CALIBRATION_SCENARIOS,
  compareCalibrationTraces,
  computeCalibrationMetrics,
  parseCalibrationTrace,
  replayCalibrationTrace,
  runCalibrationScenario,
  CALIBRATION_TRACE_KIND,
  CALIBRATION_TRACE_VERSION,
} from "@/lib/calibration";

describe("calibration scenarios", () => {
  it("are deterministic across two runs", () => {
    const a = runCalibrationScenario(CALIBRATION_SCENARIOS.find((s) => s.id === "cruise-80")!);
    const b = runCalibrationScenario(CALIBRATION_SCENARIOS.find((s) => s.id === "cruise-80")!);
    expect(a.samples.length).toBe(b.samples.length);
    expect(a.samples.map((s) => s.gear)).toEqual(b.samples.map((s) => s.gear));
    expect(a.samples.map((s) => Math.round(s.rpm))).toEqual(
      b.samples.map((s) => Math.round(s.rpm)),
    );
  });

  it("gentle launch produces upshifts without hunting flags", () => {
    const trace = runCalibrationScenario(
      CALIBRATION_SCENARIOS.find((s) => s.id === "gentle-city-launch")!,
    );
    const m = computeCalibrationMetrics(trace);
    expect(m.upshifts).toBeGreaterThanOrEqual(1);
    expect(m.gearHuntingEvents).toBe(0);
  });

  it("noisy GPS scenario does not hunt", () => {
    const trace = runCalibrationScenario(
      CALIBRATION_SCENARIOS.find((s) => s.id === "noisy-gps-2")!,
    );
    const m = computeCalibrationMetrics(trace);
    expect(m.gearHuntingEvents).toBe(0);
    expect(m.flags.some((f) => f.includes("hunting"))).toBe(false);
  });

  it("replay resimulation stays stable for cruise", () => {
    const input = runCalibrationScenario(CALIBRATION_SCENARIOS.find((s) => s.id === "cruise-50")!);
    const once = replayCalibrationTrace(input, { profileId: "gt-v8", audioSeed: 7 });
    const twice = replayCalibrationTrace(input, { profileId: "gt-v8", audioSeed: 7 });
    expect(once.samples.map((s) => s.gear)).toEqual(twice.samples.map((s) => s.gear));
  });
});

describe("calibration schema", () => {
  it("rejects wrong kind / version", () => {
    expect(() => parseCalibrationTrace({ kind: "nope", version: 1, samples: [] })).toThrow();
    expect(() =>
      parseCalibrationTrace({
        kind: CALIBRATION_TRACE_KIND,
        version: 99,
        samples: [],
        meta: { profileId: "gt-v8" },
      }),
    ).toThrow(/version/);
  });

  it("round-trips JSON", () => {
    const trace = runCalibrationScenario(CALIBRATION_SCENARIOS.find((s) => s.id === "cruise-120")!);
    const raw = JSON.parse(JSON.stringify(trace));
    const parsed = parseCalibrationTrace(raw);
    expect(parsed.version).toBe(CALIBRATION_TRACE_VERSION);
    expect(parsed.samples.length).toBe(trace.samples.length);
  });
});

describe("calibration comparison", () => {
  it("reports shift speed deltas without inventing a realism score", () => {
    const a = runCalibrationScenario(CALIBRATION_SCENARIOS.find((s) => s.id === "hard-accel")!);
    const b = replayCalibrationTrace(a, { profileId: "gt-v8" }).output;
    const report = compareCalibrationTraces(a, b);
    expect(report.narrative.some((n) => n.includes("realism"))).toBe(true);
    expect(report.beforeMetrics.upshifts).toBeGreaterThanOrEqual(0);
  });
});

describe("regression fixtures (sanitized scenarios)", () => {
  const fixtureIds = [
    "gentle-city-launch",
    "cruise-80",
    "highway-kickdown",
    "noisy-gps-2",
    "phone-relay-reconnect",
  ] as const;

  it.each(fixtureIds)("%s fixture replays without hunting / geo data", async (id) => {
    const raw = (await import(`./fixtures/${id}.json`)).default;
    const fixture = parseCalibrationTrace(raw);
    expect(fixture.kind).toBe(CALIBRATION_TRACE_KIND);
    expect(JSON.stringify(fixture)).not.toMatch(/latitud|longitud|"lat"|"lng"/i);

    const live = runCalibrationScenario(CALIBRATION_SCENARIOS.find((s) => s.id === id)!);
    const liveMetrics = computeCalibrationMetrics(live);
    expect(liveMetrics.gearHuntingEvents).toBe(0);
    expect(liveMetrics.rpmDiscontinuitiesOutsideShifts).toBeLessThan(8);
    expect(liveMetrics.sensorTransitionInducedShifts).toBe(0);

    const replayed = replayCalibrationTrace(fixture, {
      profileId: fixture.meta.profileId || "gt-v8",
      audioSeed: 11,
    });
    const replayMetrics = computeCalibrationMetrics(replayed.output);
    expect(replayMetrics.gearHuntingEvents).toBe(0);
  });
});
