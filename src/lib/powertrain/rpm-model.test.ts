import { describe, expect, it } from "vitest";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  normalizeRpm,
  rpmAfterUpshift,
  rpmFromSpeedAndGear,
  wheelRpmFromSpeedKmh,
} from "@/lib/powertrain/rpm-model";

const flatSix = getPowertrainProfile("flat-six-sport");
const muscle = getPowertrainProfile("american-v8");

describe("rpmFromSpeedAndGear", () => {
  it("returns higher RPM in lower gears at the same speed", () => {
    const kmh = 80;
    const g1 = rpmFromSpeedAndGear(kmh, 1, flatSix);
    const g3 = rpmFromSpeedAndGear(kmh, 3, flatSix);
    expect(g1).toBeGreaterThan(g3);
  });

  it("scales predictably for a known speed and gear", () => {
    const wheelRpm = wheelRpmFromSpeedKmh(100, flatSix.wheelCircumferenceM);
    const ratio = flatSix.transmission.gearRatios[2]!;
    const expected = wheelRpm * ratio * flatSix.transmission.finalDrive;
    expect(rpmFromSpeedAndGear(100, 3, flatSix)).toBeCloseTo(expected, 0);
  });

  it("clamps to redline", () => {
    const rpm = rpmFromSpeedAndGear(280, flatSix.transmission.gears, flatSix);
    expect(rpm).toBeLessThanOrEqual(flatSix.engine.redlineRpm);
  });
});

describe("rpmAfterUpshift", () => {
  it("drops RPM after upshift at constant speed", () => {
    const { before, after } = rpmAfterUpshift(90, 2, 3, flatSix);
    expect(before).toBeGreaterThan(after);
  });

  it("works for different profiles", () => {
    const { before, after } = rpmAfterUpshift(70, 1, 2, muscle);
    expect(before).toBeGreaterThan(after);
  });
});

describe("normalizeRpm", () => {
  it("is 0 at idle and approaches 1 near redline", () => {
    expect(normalizeRpm(flatSix.engine.idleRpm, flatSix)).toBeCloseTo(0, 2);
    expect(normalizeRpm(flatSix.engine.redlineRpm, flatSix)).toBeCloseTo(1, 2);
  });
});
