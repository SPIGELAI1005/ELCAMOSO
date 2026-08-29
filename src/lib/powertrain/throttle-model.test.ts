import { describe, expect, it } from "vitest";
import type { VehicleMotionState } from "@/lib/motion/types";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { createThrottleModelState, updateThrottleModel } from "@/lib/powertrain/throttle-model";

const profile = getPowertrainProfile("american-v8");

function motion(accel: number, speed = 60): VehicleMotionState {
  return {
    timestamp: 1,
    speedKmh: speed,
    accelerationMs2: accel,
    accelerationFiltered: accel,
    decelerationMs2: Math.max(0, -accel),
    inferredThrottle: 0,
    motionConfidence: 1,
    primarySource: "simulator",
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    fallbackTier: "decay",
    transitioning: false,
  };
}

function phoneMotion(
  accelTransient: number,
  accelFiltered: number,
  speed = 40,
): VehicleMotionState {
  return {
    timestamp: 1,
    speedKmh: speed,
    accelerationMs2: accelTransient,
    accelerationFiltered: accelFiltered,
    decelerationMs2: 0,
    inferredThrottle: 0.4,
    motionConfidence: 0.9,
    primarySource: "phone",
    sourceHealth: { phone: true, browser: false, vehicleTelemetry: false },
    fallbackTier: "phone",
    transitioning: false,
  };
}

describe("updateThrottleModel", () => {
  it("ramps throttle smoothly under attack filtering", () => {
    let state = createThrottleModelState();
    let throttle = 0;
    for (let i = 0; i < 40; i += 1) {
      const r = updateThrottleModel({
        motion: motion(2.8),
        profile,
        rpmNormalized: 0.6,
        dt: 0.016,
        state,
      });
      state = r.state;
      throttle = r.throttle;
    }
    expect(throttle).toBeGreaterThan(0.4);
    expect(throttle).toBeLessThan(1);
  });

  it("load rises with throttle and RPM independently", () => {
    const low = updateThrottleModel({
      motion: motion(0.2),
      profile,
      rpmNormalized: 0.2,
      dt: 0.05,
      state: createThrottleModelState(),
    });
    const high = updateThrottleModel({
      motion: motion(3.2),
      profile,
      directThrottle: 0.95,
      rpmNormalized: 0.85,
      dt: 0.1,
      state: createThrottleModelState(),
    });
    expect(high.load).toBeGreaterThan(low.load);
  });

  it("reacts faster to phone IMU transients than filtered accel alone", () => {
    let phoneState = createThrottleModelState();
    let filteredState = createThrottleModelState();
    let phoneThrottle = 0;
    let filteredThrottle = 0;
    let phoneLoad = 0;
    let filteredLoad = 0;

    for (let i = 0; i < 12; i += 1) {
      const phone = updateThrottleModel({
        motion: phoneMotion(2.8, 0.35, 35),
        profile,
        rpmNormalized: 0.45,
        dt: 0.016,
        state: phoneState,
      });
      phoneState = phone.state;
      phoneThrottle = phone.throttle;
      phoneLoad = phone.load;

      const filtered = updateThrottleModel({
        motion: motion(0.35, 35),
        profile,
        rpmNormalized: 0.45,
        dt: 0.016,
        state: filteredState,
      });
      filteredState = filtered.state;
      filteredThrottle = filtered.throttle;
      filteredLoad = filtered.load;
    }

    expect(phoneThrottle).toBeGreaterThan(filteredThrottle + 0.12);
    expect(phoneLoad).toBeGreaterThan(filteredLoad);
  });
});
