import { describe, expect, it } from "vitest";
import type { VehicleMotionState } from "@/lib/motion/types";
import {
  createSimulatorRuntime,
  motionFromSimulator,
  type SimulatorControls,
} from "@/lib/powertrain/dev-simulator";
import { getPowertrainProfile, POWERTRAIN_PROFILES } from "@/lib/powertrain/profiles";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";

function runScenario(
  profileId: string,
  steps: (controls: SimulatorControls, i: number) => SimulatorControls,
  frames = 240,
) {
  const sim = new PowertrainSimulator({ profileId });
  const runtime = createSimulatorRuntime(undefined, {
    integrateSpeed: false,
    maxAccelMs2: 4,
    maxBrakeMs2: 7,
  });
  let controls: SimulatorControls = { speedKmh: 0, accelerationMs2: 0, throttle: 0, braking: 0 };
  let last = sim.tick(motionFromSimulator(controls, runtime, 0, 0.016), 0.016);
  for (let i = 0; i < frames; i += 1) {
    controls = steps(controls, i);
    const motion = motionFromSimulator(controls, runtime, i * 16, 0.016);
    last = sim.tick(motion, 0.016, {
      directThrottle: controls.throttle,
      braking: controls.braking,
    });
  }
  return last;
}

describe("PowertrainSimulator", () => {
  it("supports every built-in profile without throwing", () => {
    for (const p of POWERTRAIN_PROFILES) {
      const sim = new PowertrainSimulator({ profile: p });
      const runtime = createSimulatorRuntime();
      const motion = motionFromSimulator(
        { speedKmh: 50, accelerationMs2: 1.2, throttle: 0.6, braking: 0 },
        runtime,
        100,
        0.016,
      );
      const out = sim.tick(motion, 0.016, { directThrottle: 0.6 });
      expect(out.rpm).toBeGreaterThan(0);
      expect(out.gear).toBeGreaterThanOrEqual(0);
    }
  });

  it("upshifts under sustained acceleration scenario", () => {
    const end = runScenario("flat-six-sport", (c, i) => ({
      speedKmh: Math.min(140, i * 0.85),
      accelerationMs2: 2.5,
      throttle: 0.92,
      braking: 0,
    }));
    expect(end.gear).toBeGreaterThan(2);
    expect(end.rpm).toBeGreaterThan(getPowertrainProfile("flat-six-sport").engine.idleRpm);
  });

  it("enters overrun on lift-off scenario", () => {
    const sim = new PowertrainSimulator({ profileId: "american-v8" });
    for (let i = 0; i < 50; i += 1) {
      sim.tick(sampleMotion(i * 16, 90, 1.5, 1.5, 0.88), 0.016, { directThrottle: 0.88 });
    }
    const out = sim.tick(sampleMotion(50 * 16, 88, 0.04, 0.04, 0.05), 0.016, {
      directThrottle: 0.04,
      braking: 0.12,
    });
    expect(out.overrun).toBe(true);
  });

  it("uses different shift behavior per profile", () => {
    const sport = runScenario("flat-six-sport", (c, i) => ({
      speedKmh: Math.min(120, 40 + i * 0.5),
      accelerationMs2: 2,
      throttle: 0.88,
      braking: 0,
    }));
    const muscle = runScenario("american-v8", (c, i) => ({
      speedKmh: Math.min(120, 40 + i * 0.5),
      accelerationMs2: 2,
      throttle: 0.88,
      braking: 0,
    }));
    expect(sport.rpm).not.toBeCloseTo(muscle.rpm, 0);
  });
});

function sampleMotion(
  timestamp: number,
  speedKmh: number,
  accelMs2: number,
  accelFiltered: number,
  inferredThrottle: number,
): VehicleMotionState {
  return {
    timestamp,
    speedKmh,
    accelerationMs2: accelMs2,
    accelerationFiltered: accelFiltered,
    decelerationMs2: Math.max(0, -accelFiltered),
    inferredThrottle,
    motionConfidence: 1,
    primarySource: "simulator",
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    fallbackTier: "decay",
    transitioning: false,
  };
}
