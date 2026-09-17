import { describe, expect, it } from "vitest";
import {
  roadLoadEstimate,
  updateDriverDemand,
  createDriverDemandState,
} from "@/lib/powertrain/driver-demand";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  rpmFromSpeedAndGear,
  rpmTrackTargetEx,
  speedKmhFromRpmAndGear,
} from "@/lib/powertrain/rpm-model";
import {
  getPowertrainScenario,
  runPowertrainScenario,
  validatePowertrainTrace,
} from "@/lib/powertrain/scenarios";
import { selectTargetGearDetailed } from "@/lib/powertrain/gear-selector";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import type { VehicleMotionState } from "@/lib/motion/types";

const profile = getPowertrainProfile("flat-six-sport");

function motion(partial: Partial<VehicleMotionState> = {}): VehicleMotionState {
  return {
    timestamp: 1,
    speedKmh: 80,
    accelerationMs2: 0,
    accelerationFiltered: 0,
    decelerationMs2: 0,
    inferredThrottle: 0.1,
    motionConfidence: 1,
    primarySource: "simulator",
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    fallbackTier: "decay",
    transitioning: false,
    ...partial,
  };
}

describe("mechanical RPM lock", () => {
  it("is deterministic at fixed speed and gear", () => {
    const a = rpmFromSpeedAndGear(90, 4, profile);
    const b = rpmFromSpeedAndGear(90, 4, profile);
    expect(a).toBe(b);
    expect(speedKmhFromRpmAndGear(a, 4, profile)).toBeCloseTo(90, 0);
  });

  it("does not wander with throttle when locked", () => {
    const low = rpmTrackTargetEx({ speedKmh: 100, gear: 5, driverDemand: 0.1 }, profile);
    const high = rpmTrackTargetEx({ speedKmh: 100, gear: 5, driverDemand: 0.95 }, profile);
    expect(Math.abs(high - low)).toBeLessThan(50);
  });
});

describe("driver demand vs road speed", () => {
  it("keeps 100 km/h cruise far below half throttle", () => {
    expect(roadLoadEstimate(100)).toBeLessThan(0.15);
    const r = updateDriverDemand({
      motion: motion({
        speedKmh: 100,
        accelerationMs2: 0,
        accelerationFiltered: 0,
        inferredThrottle: 0.08,
      }),
      profile,
      rpmNormalized: 0.35,
      dt: 0.05,
      state: createDriverDemandState(),
      directThrottle: 0.12,
    });
    expect(r.driverDemand).toBeLessThan(0.35);
  });
});

describe("demand-ordered upshifts", () => {
  it("gentle shifts earlier than medium; medium earlier than WOT", () => {
    const gentle = runPowertrainScenario(getPowertrainScenario("gentle-0-60")!);
    const medium = runPowertrainScenario(getPowertrainScenario("medium-0-100")!);
    const wot = runPowertrainScenario(getPowertrainScenario("hard-0-100")!);

    const firstUp = (r: typeof gentle) => r.gearChanges.find((c) => c.to === c.from + 1);
    const g = firstUp(gentle);
    const m = firstUp(medium);
    const w = firstUp(wot);
    expect(g).toBeTruthy();
    expect(m).toBeTruthy();
    expect(w).toBeTruthy();

    const speedAt = (result: typeof gentle, atMs: number) =>
      result.samples.find((s) => s.tMs >= atMs)?.speedKmh ?? 0;

    expect(speedAt(gentle, g!.atMs)).toBeLessThanOrEqual(speedAt(medium, m!.atMs) + 2);
    expect(speedAt(medium, m!.atMs)).toBeLessThanOrEqual(speedAt(wot, w!.atMs) + 2);
  });
});

describe("kickdown queue", () => {
  it("queues desired gear below current and steps toward it", () => {
    const p = getPowertrainProfile("gt-v8");
    const speed = 110;
    const detailed = selectTargetGearDetailed(
      {
        currentGear: 6,
        rpm: rpmFromSpeedAndGear(speed, 6, p) * 0.55,
        throttle: 0.95,
        load: 0.9,
        speedKmh: speed,
        shiftDecisionSpeedKmh: speed,
        braking: 0,
        lastShiftCompletedAt: 0,
        now: 20_000,
        lastShiftWasUp: false,
        blockDownshiftUntil: 0,
        shifting: false,
        previousDemand: 0.25,
      },
      p,
    );
    expect(detailed.reason).toBe("kickdown");
    expect(detailed.desiredGear).toBeLessThan(6);

    const sim = new PowertrainSimulator({ profile: p });
    const internals = sim.getInternals() as {
      gear: number;
      rpm: number;
      lastShiftCompletedAt: number;
      shiftDecisionSpeedKmh: number;
      previousThrottle: number;
    };
    // Tall gear, modest speed → mechanical RPM below kickdown gate.
    const cruiseSpeed = 85;
    internals.gear = 6;
    internals.rpm = rpmFromSpeedAndGear(cruiseSpeed, 6, p);
    internals.lastShiftCompletedAt = -60_000;
    internals.shiftDecisionSpeedKmh = cruiseSpeed;
    internals.previousThrottle = 0.2;

    let sawQueue = false;
    let sawStep = false;
    for (let i = 0; i < 40; i += 1) {
      const out = sim.tick(
        motion({
          speedKmh: cruiseSpeed,
          timestamp: 30_000 + i * 16,
          inferredThrottle: 0.95,
          accelerationFiltered: 2.5,
          accelerationMs2: 2.5,
        }),
        0.016,
        { directThrottle: 0.95 },
      );
      if (out.queuedTargetGear < 6) sawQueue = true;
      if (out.shifting && (out.targetGear === 5 || out.gear === 5)) sawStep = true;
      if (out.gear === 5 && !out.shifting) sawStep = true;
    }
    expect(sawQueue).toBe(true);
    expect(sawStep).toBe(true);
  });

  it("reports multi-step desired gear for motorcycle kickdown maxSteps", () => {
    const bike = getPowertrainProfile("motorcycle-inline-4");
    const speed = 100;
    const detailed = selectTargetGearDetailed(
      {
        currentGear: 5,
        rpm: rpmFromSpeedAndGear(speed, 5, bike) * 0.55,
        throttle: 0.95,
        load: 0.9,
        speedKmh: speed,
        shiftDecisionSpeedKmh: speed,
        braking: 0,
        lastShiftCompletedAt: 0,
        now: 20_000,
        lastShiftWasUp: false,
        blockDownshiftUntil: 0,
        shifting: false,
        previousDemand: 0.2,
      },
      bike,
    );
    expect(detailed.reason).toBe("kickdown");
    expect(detailed.desiredGear).toBeLessThanOrEqual(5 - 1);
    expect(5 - detailed.desiredGear).toBeGreaterThanOrEqual(1);
    expect(5 - detailed.desiredGear).toBeLessThanOrEqual(bike.transmission.kickdown.maxSteps);
  });
});

describe("noise and source robustness", () => {
  it("does not hunt with ±2 km/h oscillation", () => {
    const result = runPowertrainScenario(getPowertrainScenario("threshold-oscillation")!);
    const validation = validatePowertrainTrace(result, profile);
    expect(validation.ok, validation.issues.join("; ")).toBe(true);
    const late = result.gearChanges.filter((c) => c.atMs > 1500);
    expect(late.length).toBeLessThan(3);
  });

  it("does not change gear solely due to sensor-source switching", () => {
    const result = runPowertrainScenario(getPowertrainScenario("source-transition")!);
    const gearAt = (tMs: number) => result.samples.find((s) => s.tMs >= tMs)?.gear ?? 0;
    expect(gearAt(3200)).toBe(gearAt(7000));
    expect(result.samples.every((s) => s.powertrainBackend === "dynamic")).toBe(true);
  });
});

describe("cruise mechanical stability", () => {
  it("holds gear and stable RPM at 80 km/h cruise", () => {
    const result = runPowertrainScenario(getPowertrainScenario("cruise-80")!);
    const mid = result.samples.slice(100);
    const gears = new Set(mid.map((s) => s.gear));
    expect(gears.size).toBe(1);
    const rpms = mid.map((s) => s.rpm);
    const spread = Math.max(...rpms) - Math.min(...rpms);
    expect(spread).toBeLessThan(120);
    expect(mid.every((s) => (s.driverDemand ?? s.throttle) < 0.4)).toBe(true);
  });
});
