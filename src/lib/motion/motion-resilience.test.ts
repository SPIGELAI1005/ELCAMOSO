import { describe, expect, it, vi } from "vitest";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import {
  browserGpsMotionSample,
  createSensorFusion,
  markPhoneRelayLost,
  markPhoneRelayRestored,
  phoneRelayMotionSample,
  pushMotionSample,
  tickSensorFusion,
  vehicleTelemetryMotionSample,
} from "@/lib/motion/sensor-fusion";
import {
  cancelPhoneRelayGrace,
  createRelayGraceState,
  RELAY_PHONE_LOST_GRACE_MS,
  schedulePhoneRelayGrace,
} from "@/lib/motion/motion-relay-resilience";

const DT = 1 / 60;

describe("motion resilience", () => {
  it("cascades telemetry → phone → browser → hold → decay", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;

    pushMotionSample(
      fusion,
      vehicleTelemetryMotionSample({
        timestamp: Date.now(),
        source: "vehicle-telemetry",
        speedKmh: 100,
        accelerationLongitudinal: 0.3,
      }),
      1000,
    );
    let motion = tickSensorFusion(fusion, { now: 1000, dt: DT });
    expect(motion.fallbackTier).toBe("vehicle-telemetry");

    for (let i = 0; i < 40; i += 1) {
      const now = 1000 + (i + 1) * 40;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 95,
          accelerationLongitudinal: 0.4,
          accuracy: 8,
        }),
        now,
      );
      motion = tickSensorFusion(fusion, { now, dt: 0.04 });
    }
    expect(motion.fallbackTier).toBe("phone");

    markPhoneRelayLost(fusion, 3000);
    pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 90 / 3.6, accuracyM: 12 }), 3200);
    for (let i = 0; i < 30; i += 1) {
      motion = tickSensorFusion(fusion, { now: 3200 + i * 40, dt: 0.04 });
    }
    expect(motion.fallbackTier).toBe("browser");
    expect(motion.speedKmh).toBeGreaterThan(70);

    const staleNow = 3200 + 6000;
    motion = tickSensorFusion(fusion, { now: staleNow, dt: DT });
    expect(["hold", "decay"]).toContain(motion.fallbackTier);
    expect(motion.speedKmh).toBeGreaterThan(0);
  });

  it("defers phone suspend until relay grace expires", () => {
    vi.useFakeTimers();
    const grace = createRelayGraceState();
    let lost = false;
    schedulePhoneRelayGrace(grace, () => {
      lost = true;
    });

    vi.advanceTimersByTime(RELAY_PHONE_LOST_GRACE_MS - 100);
    expect(lost).toBe(false);

    cancelPhoneRelayGrace(grace);
    vi.advanceTimersByTime(500);
    expect(lost).toBe(false);
    vi.useRealTimers();
  });

  it("coasts through packet-loss gap without speed cliff", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 25;
    fusion.speedAnchorMs = 25;

    for (let i = 0; i < 60; i += 1) {
      const now = (i + 1) * 40;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 90,
          accelerationLongitudinal: 0.3,
          accuracy: 8,
        }),
        now,
      );
      tickSensorFusion(fusion, { now, dt: 0.04 });
    }

    const speeds: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const now = 3000 + i * 40;
      const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
      speeds.push(motion.speedKmh);
    }

    const maxDrop = speeds.reduce((max, speed, idx) => {
      if (idx === 0) return max;
      return Math.max(max, speeds[idx - 1]! - speed);
    }, 0);

    expect(speeds[0]).toBeGreaterThan(60);
    expect(maxDrop).toBeLessThan(8);
  });

  it("limits RPM jump after phone reconnect following grace loss", () => {
    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 28;
    fusion.speedAnchorMs = 28;

    let rpm = 0;
    for (let i = 0; i < 100; i += 1) {
      const now = (i + 1) * 16;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 100,
          accelerationLongitudinal: 0.5,
          accuracy: 8,
        }),
        now,
      );
      rpm = sim.tick(tickSensorFusion(fusion, { now, dt: 0.016 }), 0.016).rpm;
    }

    markPhoneRelayLost(fusion, 2000);
    for (let i = 0; i < 30; i += 1) {
      rpm = sim.tick(tickSensorFusion(fusion, { now: 2000 + i * 16, dt: 0.016 }), 0.016).rpm;
    }

    markPhoneRelayRestored(fusion, 2500);
    let maxJump = 0;
    let prev = rpm;
    for (let i = 0; i < 60; i += 1) {
      const now = 2500 + i * 16;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 102,
          accelerationLongitudinal: 0.8,
          accuracy: 8,
        }),
        now,
      );
      const next = sim.tick(tickSensorFusion(fusion, { now, dt: 0.016 }), 0.016).rpm;
      maxJump = Math.max(maxJump, Math.abs(next - prev));
      prev = next;
    }

    expect(maxJump).toBeLessThan(850);
  });
});
