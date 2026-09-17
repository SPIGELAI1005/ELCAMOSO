import { describe, expect, it } from "vitest";
import {
  selectTargetGear,
  selectTargetGearDetailed,
  upshiftRpmForLoad,
} from "@/lib/powertrain/gear-selector";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import {
  resolveShiftMap,
  upshiftSpeedForDemand,
  validateShiftMap,
} from "@/lib/powertrain/shift-map";
import { rpmFromSpeedAndGear, speedKmhFromRpmAndGear } from "@/lib/powertrain/rpm-model";

const profile = getPowertrainProfile("flat-six-sport");
const map = resolveShiftMap(profile);

function ctx(overrides: Partial<Parameters<typeof selectTargetGear>[0]> = {}) {
  return {
    currentGear: 3,
    rpm: 5000,
    throttle: 0.5,
    load: 0.5,
    speedKmh: 80,
    shiftDecisionSpeedKmh: 80,
    braking: 0,
    lastShiftCompletedAt: 0,
    now: 10_000,
    lastShiftWasUp: false,
    blockDownshiftUntil: 0,
    shifting: false,
    ...overrides,
  };
}

describe("shift map", () => {
  it("validates generated map for flat-six", () => {
    const validation = validateShiftMap(map, profile);
    expect(validation.ok, validation.issues.join("; ")).toBe(true);
  });

  it("WOT upshift speed is at or above gentle for each gear", () => {
    for (let g = 1; g < profile.transmission.gears; g += 1) {
      const gentle = upshiftSpeedForDemand(map, g, 0.1);
      const wot = upshiftSpeedForDemand(map, g, 0.95);
      expect(wot).toBeGreaterThanOrEqual(gentle - 0.05);
    }
  });
});

describe("upshiftRpmForLoad", () => {
  it("interpolates between load bands", () => {
    const low = upshiftRpmForLoad(0.1, 0.1, profile);
    const mid = upshiftRpmForLoad(0.5, 0.5, profile);
    const high = upshiftRpmForLoad(0.9, 0.9, profile);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });
});

describe("selectTargetGear", () => {
  it("requests upshift when decision speed exceeds schedule", () => {
    const upLine = upshiftSpeedForDemand(map, 3, 0.5);
    const target = selectTargetGear(
      ctx({
        speedKmh: upLine + 8,
        shiftDecisionSpeedKmh: upLine + 8,
        rpm: rpmFromSpeedAndGear(upLine + 8, 3, profile),
      }),
      profile,
    );
    expect(target).toBe(4);
  });

  it("requests downshift when speed is below schedule", () => {
    const target = selectTargetGear(
      ctx({
        currentGear: 4,
        throttle: 0.1,
        load: 0.1,
        speedKmh: 25,
        shiftDecisionSpeedKmh: 25,
        rpm: rpmFromSpeedAndGear(25, 4, profile),
      }),
      profile,
    );
    expect(target).toBe(3);
  });

  it("applies speed hysteresis after a recent upshift", () => {
    const upLine = upshiftSpeedForDemand(map, 3, 0.5);
    const speed = upLine + map.speedHysteresisKmh + 0.5;
    const without = selectTargetGear(
      ctx({
        speedKmh: speed,
        shiftDecisionSpeedKmh: speed,
        lastShiftWasUp: false,
        rpm: rpmFromSpeedAndGear(speed, 3, profile),
      }),
      profile,
    );
    const withHyst = selectTargetGear(
      ctx({
        speedKmh: speed,
        shiftDecisionSpeedKmh: speed,
        lastShiftWasUp: true,
        rpm: rpmFromSpeedAndGear(speed, 3, profile),
      }),
      profile,
    );
    expect(without).toBe(4);
    expect(withHyst).toBe(3);
  });

  it("kickdown requests lower gear under heavy throttle", () => {
    const speed = 95;
    const detailed = selectTargetGearDetailed(
      ctx({
        currentGear: 5,
        speedKmh: speed,
        shiftDecisionSpeedKmh: speed,
        rpm: rpmFromSpeedAndGear(speed, 5, profile) * 0.7,
        throttle: 0.92,
        load: 0.88,
        previousDemand: 0.3,
      }),
      profile,
    );
    expect(detailed.reason).toBe("kickdown");
    expect(detailed.desiredGear).toBeLessThan(5);
  });

  it("respects minimum gear hold time", () => {
    const upLine = upshiftSpeedForDemand(map, 3, 0.9);
    const target = selectTargetGear(
      ctx({
        speedKmh: upLine + 20,
        shiftDecisionSpeedKmh: upLine + 20,
        throttle: 0.9,
        load: 0.9,
        lastShiftCompletedAt: 9_200,
        now: 9_800,
      }),
      profile,
    );
    expect(target).toBe(3);
  });

  it("blocks shifts while already shifting", () => {
    const target = selectTargetGear(ctx({ rpm: 7500, shifting: true, currentGear: 3 }), profile);
    expect(target).toBe(3);
  });

  it("forces upshift at redline soft limit", () => {
    const soft = profile.engine.redlineRpm * profile.transmission.redline.softFraction;
    const target = selectTargetGear(
      ctx({ rpm: soft + 50, currentGear: 3, throttle: 0.5 }),
      profile,
    );
    expect(target).toBe(4);
  });

  it("refuses downshift that would exceed redline protection", () => {
    // High speed in gear 3 — dropping to 2 would exceed redline fraction.
    const unsafe = speedKmhFromRpmAndGear(
      profile.engine.redlineRpm * profile.transmission.redline.maxDownshiftFraction + 400,
      2,
      profile,
    );
    const detailed = selectTargetGearDetailed(
      ctx({
        currentGear: 3,
        throttle: 0.05,
        load: 0.05,
        speedKmh: unsafe,
        shiftDecisionSpeedKmh: unsafe,
        rpm: rpmFromSpeedAndGear(unsafe, 3, profile),
      }),
      profile,
    );
    // May upshift on schedule, but must not downshift to 2.
    expect(detailed.desiredGear).toBeGreaterThanOrEqual(3);
  });
});
