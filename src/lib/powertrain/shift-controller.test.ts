import { describe, expect, it } from "vitest";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmAfterUpshift } from "@/lib/powertrain/rpm-model";
import {
  beginShift,
  createShiftControllerState,
  tickShift,
} from "@/lib/powertrain/shift-controller";

const profile = getPowertrainProfile("gt-v8");

describe("upshift", () => {
  it("completes exactly one shift and lowers RPM", () => {
    const speed = 95;
    const { before, after } = rpmAfterUpshift(speed, 2, 3, profile);
    let state = beginShift(createShiftControllerState(), "up", 2, 3, speed, before, profile);
    let rpm = before;
    let completed = false;
    for (let i = 0; i < 200; i += 1) {
      const step = tickShift(state, 0.016, profile);
      state = step.state;
      rpm = step.rpm;
      if (step.complete) {
        completed = true;
        expect(step.completedGear).toBe(3);
        expect(step.completedDirection).toBe("up");
        break;
      }
    }
    expect(completed).toBe(true);
    expect(rpm).toBeLessThan(before);
    expect(rpm).toBeCloseTo(after, -1);
  });
});

describe("downshift rev-match", () => {
  it("raises RPM during rev-match before settling", () => {
    const speed = 60;
    const before = rpmAfterUpshift(speed, 3, 2, profile).before;
    let state = beginShift(createShiftControllerState(), "down", 3, 2, speed, before, profile);
    expect(state.revMatchActive).toBe(true);
    let peak = before;
    for (let i = 0; i < 4; i += 1) {
      const step = tickShift(state, 0.016, profile);
      state = step.state;
      peak = Math.max(peak, step.rpm);
    }
    expect(peak).toBeGreaterThan(before * 1.01);
  });
});

describe("shift RPM drop", () => {
  it("next gear produces lower RPM at same speed", () => {
    const speed = 110;
    const drop = rpmAfterUpshift(speed, 4, 5, profile);
    expect(drop.after).toBeLessThan(drop.before);
  });
});
