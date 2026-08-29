import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIMULATOR_CONTROLS,
  createSimulatorRuntime,
  motionFromSimulator,
  stepSimulatorControls,
} from "@/lib/powertrain/dev-simulator";

describe("dev-simulator", () => {
  it("integrates speed from throttle and braking", () => {
    const runtime = createSimulatorRuntime(
      { speedKmh: 0, accelerationMs2: 0, throttle: 0, braking: 0 },
      { integrateSpeed: true, maxAccelMs2: 4, maxBrakeMs2: 8 },
    );

    let controls = { speedKmh: 0, accelerationMs2: 0, throttle: 0.9, braking: 0 };
    for (let i = 0; i < 120; i++) {
      controls = stepSimulatorControls(runtime, controls, 0.016);
    }

    expect(controls.speedKmh).toBeGreaterThan(20);
    expect(controls.accelerationMs2).toBeGreaterThan(0);
  });

  it("maps controls to VehicleMotionState with simulator source", () => {
    const runtime = createSimulatorRuntime();
    const controls = { speedKmh: 72, accelerationMs2: 2.1, throttle: 0.7, braking: 0 };
    const motion = motionFromSimulator(controls, runtime, 1000, 0.016);

    expect(motion.primarySource).toBe("simulator");
    expect(motion.speedKmh).toBe(72);
    expect(motion.inferredThrottle).toBeGreaterThan(0.2);
    expect(motion.motionConfidence).toBe(1);
  });

  it("does not integrate when physics.integrateSpeed is false", () => {
    const runtime = createSimulatorRuntime(DEFAULT_SIMULATOR_CONTROLS, {
      integrateSpeed: false,
      maxAccelMs2: 4,
      maxBrakeMs2: 8,
    });
    const controls = { speedKmh: 40, accelerationMs2: 0, throttle: 1, braking: 0 };
    const next = stepSimulatorControls(runtime, controls, 0.1);
    expect(next.speedKmh).toBe(40);
  });
});
