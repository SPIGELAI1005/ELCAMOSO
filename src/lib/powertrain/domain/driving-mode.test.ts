import { describe, expect, it } from "vitest";
import { resolveDrivingMode } from "@/lib/powertrain/domain/driving-mode";

describe("resolveDrivingMode", () => {
  it("prioritizes shift and overrun", () => {
    expect(
      resolveDrivingMode({
        speedKmh: 80,
        throttle: 0.5,
        accel: 1,
        shifting: true,
        overrun: true,
        gear: 4,
      }),
    ).toBe("shift");

    expect(
      resolveDrivingMode({
        speedKmh: 80,
        throttle: 0.1,
        accel: -0.2,
        shifting: false,
        overrun: true,
        gear: 4,
      }),
    ).toBe("overrun");
  });

  it("classifies idle, acceleration, and cruise", () => {
    expect(
      resolveDrivingMode({
        speedKmh: 0,
        throttle: 0,
        accel: 0,
        shifting: false,
        overrun: false,
        gear: 0,
      }),
    ).toBe("idle");

    expect(
      resolveDrivingMode({
        speedKmh: 60,
        throttle: 0.8,
        accel: 2.8,
        shifting: false,
        overrun: false,
        gear: 3,
      }),
    ).toBe("hard-acceleration");

    expect(
      resolveDrivingMode({
        speedKmh: 100,
        throttle: 0.3,
        accel: 0.1,
        shifting: false,
        overrun: false,
        gear: 5,
      }),
    ).toBe("cruise");
  });
});
