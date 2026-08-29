import { describe, expect, it } from "vitest";
import { selectTargetGear, upshiftRpmForLoad } from "@/lib/powertrain/gear-selector";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { rpmFromSpeedAndGear } from "@/lib/powertrain/rpm-model";

const profile = getPowertrainProfile("flat-six-sport");

function ctx(overrides: Partial<Parameters<typeof selectTargetGear>[0]> = {}) {
  return {
    currentGear: 3,
    rpm: 5000,
    throttle: 0.5,
    load: 0.5,
    speedKmh: 80,
    braking: 0,
    lastShiftCompletedAt: 0,
    now: 10_000,
    lastShiftWasUp: false,
    blockDownshiftUntil: 0,
    shifting: false,
    ...overrides,
  };
}

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
  it("requests upshift when RPM exceeds load-dependent threshold", () => {
    const upshift = upshiftRpmForLoad(0.5, 0.5, profile);
    const target = selectTargetGear(ctx({ rpm: upshift + 200 }), profile);
    expect(target).toBe(4);
  });

  it("requests downshift when RPM is low", () => {
    const target = selectTargetGear(
      ctx({
        rpm: profile.transmission.downshift.baseRpm - 600,
        currentGear: 4,
      }),
      profile,
    );
    expect(target).toBe(3);
  });

  it("applies upshift hysteresis after a recent upshift", () => {
    const upshift = upshiftRpmForLoad(0.5, 0.5, profile);
    const without = selectTargetGear(ctx({ rpm: upshift + 40, lastShiftWasUp: false }), profile);
    const withHyst = selectTargetGear(ctx({ rpm: upshift + 40, lastShiftWasUp: true }), profile);
    expect(without).toBe(4);
    expect(withHyst).toBe(3);
  });

  it("kickdown requests one lower gear under heavy throttle", () => {
    const upshift = upshiftRpmForLoad(0.85, 0.9, profile);
    const target = selectTargetGear(
      ctx({
        currentGear: 5,
        rpm: upshift * profile.transmission.kickdown.rpmFractionOfUpshift * 0.95,
        throttle: 0.92,
        load: 0.88,
      }),
      profile,
    );
    expect(target).toBe(4);
  });

  it("respects minimum gear hold time", () => {
    const upshift = upshiftRpmForLoad(0.9, 0.9, profile);
    const target = selectTargetGear(
      ctx({
        rpm: upshift + 500,
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

  it("blocks kickdown under heavy braking", () => {
    const upshift = upshiftRpmForLoad(0.85, 0.9, profile);
    const target = selectTargetGear(
      ctx({
        currentGear: 5,
        rpm: upshift * profile.transmission.kickdown.rpmFractionOfUpshift * 0.95,
        throttle: 0.92,
        load: 0.88,
        braking: 0.85,
      }),
      profile,
    );
    expect(target).toBe(5);
  });

  it("refuses downshift that would exceed redline", () => {
    const highSpeed = 180;
    const gear = 2;
    const rpm = rpmFromSpeedAndGear(highSpeed, gear, profile);
    const target = selectTargetGear(
      ctx({ currentGear: gear, rpm: rpm * 0.4, speedKmh: highSpeed, throttle: 0.1 }),
      profile,
    );
    expect(target).toBe(gear);
  });
});

describe("hysteresis — no gear bouncing", () => {
  it("holds gear when RPM oscillates near upshift threshold after upshift", () => {
    const upshift = upshiftRpmForLoad(0.5, 0.5, profile);
    const g1 = selectTargetGear(ctx({ rpm: upshift - 50 }), profile);
    const g2 = selectTargetGear(
      ctx({ rpm: upshift - 50, currentGear: g1, lastShiftWasUp: true }),
      profile,
    );
    expect(g2).toBe(g1);
  });
});
