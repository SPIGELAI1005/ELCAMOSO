import { describe, expect, it } from "vitest";
import {
  applyAccelDeadband,
  buildPhoneMotionSample,
  computeNoiseFloor,
  headingFromOrientation,
  normalizeHeading,
} from "@/lib/motion/phone-sensor-normalize";

describe("phone-sensor-normalize", () => {
  it("zeros accel inside deadband", () => {
    expect(applyAccelDeadband(0.1, 1)).toBe(0);
    expect(applyAccelDeadband(0.5, 1)).toBe(0.5);
  });

  it("wraps heading to 0..360", () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(370)).toBe(10);
  });

  it("derives noise floor from calibration samples", () => {
    expect(computeNoiseFloor([1, 2, 3, 4, 5], 0)).toBe(4);
  });

  it("builds samples without coordinates", () => {
    const sample = buildPhoneMotionSample(
      {
        speedMs: 10,
        accelLong: 1.2,
        accelLat: -0.4,
        heading: 90,
        accuracyM: 12,
        gyroX: 1,
        gyroY: 2,
        gyroZ: 3,
        gpsAt: 100,
        imuAt: 100,
      },
      150,
    );
    expect(sample?.source).toBe("phone");
    expect(sample?.speedKmh).toBe(36);
    expect(sample).not.toHaveProperty("latitude");
    expect(sample).not.toHaveProperty("longitude");
  });

  it("returns null when sensors are stale", () => {
    expect(
      buildPhoneMotionSample(
        {
          speedMs: 0,
          accelLong: 0,
          accelLat: 0,
          heading: null,
          accuracyM: null,
          gyroX: null,
          gyroY: null,
          gyroZ: null,
          gpsAt: 0,
          imuAt: 0,
        },
        10_000,
      ),
    ).toBeNull();
  });

  it("reads compass heading from orientation event", () => {
    const event = { webkitCompassHeading: 45 } as DeviceOrientationEvent;
    expect(headingFromOrientation(event)).toBe(45);
  });
});
