import { describe, expect, it } from "vitest";
import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import {
  deriveMotionState,
  isDrivingSafetySpeed,
  rawMotionEnergy,
} from "@/lib/drive/motion-energy";

function stateOf(partial: Partial<DriveState>): DriveState {
  return { ...IDLE_STATE, ...partial };
}

describe("motion energy", () => {
  it("is near zero when stationary", () => {
    expect(rawMotionEnergy(IDLE_STATE)).toBeLessThan(0.05);
    expect(deriveMotionState(IDLE_STATE).motionEnergy).toBeLessThan(0.05);
  });

  it("rises with cruise speed without throttle punch", () => {
    const cruise = stateOf({
      speed: 25,
      speedNormalized: 0.55,
      throttle: 0.15,
      accelerationNormalized: 0.05,
    });
    const energy = rawMotionEnergy(cruise);
    expect(energy).toBeGreaterThan(0.12);
    expect(energy).toBeLessThan(0.55);
  });

  it("punches higher under throttle + accel + jerk", () => {
    const punch = stateOf({
      speedNormalized: 0.4,
      throttle: 0.9,
      accelerationNormalized: 0.85,
      jerk: 0.7,
    });
    const cruise = stateOf({
      speedNormalized: 0.4,
      throttle: 0.2,
      accelerationNormalized: 0.05,
      jerk: 0,
    });
    expect(rawMotionEnergy(punch)).toBeGreaterThan(rawMotionEnergy(cruise));
  });

  it("lowers energy under regen", () => {
    const coasting = stateOf({
      speedNormalized: 0.5,
      throttle: 0.1,
      regen: 0.8,
      accelerationNormalized: 0.2,
    });
    const sameNoRegen = stateOf({
      speedNormalized: 0.5,
      throttle: 0.1,
      regen: 0,
      accelerationNormalized: 0.2,
    });
    expect(rawMotionEnergy(coasting)).toBeLessThan(rawMotionEnergy(sameNoRegen));
  });

  it("smooths across frames", () => {
    const punch = stateOf({
      speedNormalized: 0.5,
      throttle: 1,
      accelerationNormalized: 1,
      jerk: 1,
    });
    const a = deriveMotionState(punch, 0, 1 / 60);
    const b = deriveMotionState(punch, a.motionEnergy, 1 / 60);
    expect(b.motionEnergy).toBeGreaterThan(a.motionEnergy);
    expect(b.motionEnergy).toBeLessThan(rawMotionEnergy(punch) + 0.01);
  });

  it("flags safety speed above 5 km/h", () => {
    expect(isDrivingSafetySpeed(0)).toBe(false);
    expect(isDrivingSafetySpeed(1 / 3.6)).toBe(false);
    expect(isDrivingSafetySpeed(6 / 3.6)).toBe(true);
  });
});
