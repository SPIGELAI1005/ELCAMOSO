import { describe, expect, it } from "vitest";
import {
  channelsFromSample,
  extrapolateSpeedMs,
  sampleHasGpsSpeed,
  sampleHasImuAccel,
  SPEED_CHANNEL_PRIORITY,
} from "@/lib/motion/sensor-fusion-channels";

describe("sensor-fusion channels", () => {
  it("maps phone relay samples to GPS and IMU channels", () => {
    const channels = channelsFromSample({
      timestamp: 1,
      source: "phone",
      speedKmh: 50,
      accelerationLongitudinal: 1.2,
    });
    expect(channels).toContain("phone-gps");
    expect(channels).toContain("phone-imu");
  });

  it("splits tesla browser GPS and IMU ingress", () => {
    expect(channelsFromSample({ timestamp: 1, source: "tesla-browser", speedKmh: 40 })).toEqual([
      "tesla-browser-gps",
    ]);
    expect(
      channelsFromSample({ timestamp: 1, source: "tesla-browser", accelerationLongitudinal: 0.5 }),
    ).toEqual(["tesla-browser-imu"]);
  });

  it("orders speed baselines telemetry → phone → browser", () => {
    expect(SPEED_CHANNEL_PRIORITY[0]).toBe("vehicle-telemetry");
    expect(SPEED_CHANNEL_PRIORITY.at(-1)).toBe("tesla-browser-gps");
  });

  it("extrapolates speed modestly from IMU during GPS lag", () => {
    const next = extrapolateSpeedMs(10, 2, 500);
    expect(next).toBeGreaterThan(10);
    expect(next).toBeLessThan(11.5);
  });

  it("detects GPS and IMU fields independently", () => {
    expect(sampleHasGpsSpeed({ timestamp: 0, source: "phone", speedKmh: 0 })).toBe(true);
    expect(sampleHasImuAccel({ timestamp: 0, source: "phone", accelerationLongitudinal: 0 })).toBe(
      true,
    );
  });
});
