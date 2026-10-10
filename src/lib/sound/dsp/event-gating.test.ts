import { describe, expect, it } from "vitest";
import type { MotionFrame } from "@/lib/sound/realism/types";
import { isMotionQualifiedForEvent } from "@/lib/sound/dsp/layers";

function frame(partial: Partial<MotionFrame> = {}): MotionFrame {
  return {
    speedMps: 0, speedKmh: 0, speedSlow: 0, speedNorm: 0, accelMps2: 0, accelFast: 0,
    throttle: 0, throttleFast: 0, regen: 0, jerk: 0, virtualRpm: 0, rpmNorm: 0,
    gear: 0, gearNorm: 0, isShifting: false, shiftDip: 0, shiftProgress: 0,
    shiftDirection: null, revMatchActive: false, revMatchProgress: 0, overrun: false,
    drivingMode: "idle", dynamicLayers: null, bodyLevel: 0.08, syntheticLoad: 0,
    engineFundamentalHz: 18, pitchTau: 0.1, stereoWidth: 0.55, dt: 1 / 60,
    raw: {} as MotionFrame["raw"],
    ...partial,
  };
}

describe("procedural event gating", () => {
  it("does not fire clocked fictional events while parked and idle", () => {
    expect(isMotionQualifiedForEvent(frame())).toBe(false);
  });

  it("qualifies motion, demand, acceleration and regen independently", () => {
    expect(isMotionQualifiedForEvent(frame({ speedSlow: 0.2 }))).toBe(true);
    expect(isMotionQualifiedForEvent(frame({ throttleFast: 0.5 }))).toBe(true);
    expect(isMotionQualifiedForEvent(frame({ accelFast: 0.4 }))).toBe(true);
    expect(isMotionQualifiedForEvent(frame({ regen: 0.5 }))).toBe(true);
  });
});
