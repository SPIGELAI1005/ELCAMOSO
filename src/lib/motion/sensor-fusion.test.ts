import { describe, expect, it } from "vitest";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import {
  browserGpsMotionSample,
  browserImuMotionSample,
  createSensorFusion,
  markTelemetryRelayLost,
  phoneRelayMotionSample,
  pushMotionSample,
  tickSensorFusion,
  vehicleTelemetryMotionSample,
} from "@/lib/motion/sensor-fusion";

const DT = 1 / 60;

function runTicks(
  frames: number,
  step: (frame: number, now: number, fusion: ReturnType<typeof createSensorFusion>) => void,
) {
  const fusion = createSensorFusion({ sensitivity: 1, noiseFloor: 0.05 });
  let motion = tickSensorFusion(fusion, { now: 0, dt: DT });
  for (let i = 0; i < frames; i += 1) {
    const now = (i + 1) * DT * 1000;
    step(i + 1, now, fusion);
    motion = tickSensorFusion(fusion, { now, dt: DT });
  }
  return motion;
}

describe("sensor fusion", () => {
  it("uses GPS as the speed baseline on steady cruise", () => {
    const motion = runTicks(180, (i, now, fusion) => {
      pushMotionSample(
        fusion,
        browserGpsMotionSample({ speedMs: 50 / 3.6, accuracyM: 8, timestamp: Date.now() }),
        now,
      );
      if (i % 3 === 0) {
        pushMotionSample(fusion, browserImuMotionSample({ accelMs2: 0.05 }), now);
      }
    });
    expect(motion.speedKmh).toBeGreaterThan(40);
    expect(motion.speedKmh).toBeLessThan(55);
    expect(motion.primarySource).toBe("tesla-browser");
    expect(motion.motionConfidence).toBeGreaterThan(0.6);
  });

  it("prefers phone GPS over browser GPS when both are fresh", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 10 / 3.6;
    fusion.speedAnchorMs = 10 / 3.6;

    let motion = tickSensorFusion(fusion, { now: 1000, dt: DT });
    for (let i = 0; i < 90; i += 1) {
      const now = 1000 + i * 16;
      pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 10 / 3.6, accuracyM: 12 }), now);
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 72,
          accuracy: 10,
        }),
        now,
      );
      motion = tickSensorFusion(fusion, { now, dt: DT });
    }

    expect(motion.primarySource).toBe("phone");
    expect(motion.speedKmh).toBeGreaterThan(58);
  });

  it("detects IMU transients before GPS catches up", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 30 / 3.6;
    fusion.speedAnchorMs = 30 / 3.6;

    pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 30 / 3.6, accuracyM: 10 }), 1000);

    let peakAccel = 0;
    for (let i = 0; i < 8; i += 1) {
      const now = 1000 + i * 40;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 30,
          accelerationLongitudinal: 2.8,
          accuracy: 12,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
      peakAccel = Math.max(peakAccel, motion.accelerationMs2);
    }

    expect(peakAccel).toBeGreaterThan(1.2);
  });

  it("enters decay tier when GPS is stale", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 80 / 3.6;
    fusion.speedAnchorMs = 80 / 3.6;
    fusion.fallback.lastAnySourceAt = 0;

    pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 80 / 3.6, accuracyM: 8 }), 0);

    let motion = tickSensorFusion(fusion, { now: 6000, dt: DT });
    for (let i = 0; i < 60; i += 1) {
      motion = tickSensorFusion(fusion, { now: 6000 + (i + 1) * DT * 1000, dt: DT });
    }

    expect(["hold", "decay"]).toContain(motion.fallbackTier);
    expect(motion.motionConfidence).toBeLessThan(0.55);
    expect(motion.speedKmh).toBeGreaterThan(0);
  });

  it("rejects poor GPS accuracy fixes", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 55 / 3.6;

    pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 120 / 3.6, accuracyM: 95 }), 1000);

    const motion = tickSensorFusion(fusion, { now: 1000, dt: DT });
    expect(motion.speedKmh).toBeLessThan(60);
  });

  it("rejects impossible GPS speed spikes", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 50 / 3.6;
    fusion.speedAnchorMs = 50 / 3.6;

    pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 50 / 3.6, accuracyM: 8 }), 1000);
    tickSensorFusion(fusion, { now: 1000, dt: DT });

    pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 140 / 3.6, accuracyM: 8 }), 1016);
    const motion = tickSensorFusion(fusion, { now: 1016, dt: DT });

    expect(motion.speedKmh).toBeLessThan(70);
  });

  it("does not map raw accelerometer spikes directly to RPM", () => {
    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 40 / 3.6;
    fusion.speedAnchorMs = 40 / 3.6;

    pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 40 / 3.6, accuracyM: 10 }), 1000);

    let rpmAfterSpike = 0;
    for (let i = 0; i < 30; i += 1) {
      const now = 1000 + i * 16;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 40,
          accelerationLongitudinal: i === 5 ? 12 : 0.2,
          accuracy: 10,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.016 });
      const pt = sim.tick(motion, 0.016);
      if (i === 6) rpmAfterSpike = pt.rpm;
    }

    const steady = sim.tick(
      tickSensorFusion(fusion, {
        now: 1500,
        dt: 0.016,
      }),
      0.016,
    );

    expect(rpmAfterSpike).toBeLessThan(steady.rpm * 1.35);
    expect(steady.gear).toBeGreaterThan(0);
  });

  it("produces physically plausible hard acceleration trace", () => {
    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });
    const fusion = createSensorFusion();

    let speedMs = 0;
    let lastRpm = 0;
    for (let i = 0; i < 500; i += 1) {
      const now = (i + 1) * 16;
      speedMs = Math.min(27.8, speedMs + 0.08);
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: speedMs * 3.6,
          accelerationLongitudinal: speedMs < 27.8 ? 2.4 : 0,
          accuracy: 8,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.016 });
      const pt = sim.tick(motion, 0.016);
      if (i > 30) {
        expect(pt.rpm).toBeGreaterThan(600);
        expect(pt.rpm).toBeLessThan(7800);
        expect(pt.rpm).toBeGreaterThanOrEqual(lastRpm * 0.5);
      }
      lastRpm = pt.rpm;
    }

    expect(lastRpm).toBeGreaterThan(2800);
  });

  it("prefers vehicle telemetry for speed baseline and boosts confidence", () => {
    const motion = runTicks(120, (i, now, fusion) => {
      pushMotionSample(
        fusion,
        vehicleTelemetryMotionSample({
          timestamp: Date.now(),
          source: "vehicle-telemetry",
          speedKmh: 88,
          accelerationLongitudinal: 1.1,
          pedalPosition: 0.35,
        }),
        now,
      );
      if (i % 2 === 0) {
        pushMotionSample(
          fusion,
          browserGpsMotionSample({ speedMs: 20 / 3.6, accuracyM: 8, timestamp: Date.now() }),
          now,
        );
      }
      if (i % 4 === 0) {
        pushMotionSample(fusion, browserImuMotionSample({ accelMs2: 2.8 }), now);
      }
    });
    expect(motion.primarySource).toBe("vehicle-telemetry");
    expect(motion.speedKmh).toBeGreaterThan(70);
    expect(motion.motionConfidence).toBeGreaterThan(0.75);
    expect(motion.sourceHealth.vehicleTelemetry).toBe(true);
  });
});

describe("sensor fusion hierarchy and correction", () => {
  it("tolerates telemetry lag while phone IMU leads transients", () => {
    const fusion = createSensorFusion({ sensitivity: 1, noiseFloor: 0.05 });
    fusion.initialized = true;
    fusion.speedAnchorMs = 22 / 3.6;
    fusion.speedFilteredMs = 22 / 3.6;

    let peakAccel = 0;
    let telemetryAt = 0;
    for (let i = 0; i < 120; i += 1) {
      const now = (i + 1) * 50;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 24,
          accelerationLongitudinal: 2.4,
          accuracy: 10,
        }),
        now,
      );
      if (now - telemetryAt >= 900) {
        telemetryAt = now;
        pushMotionSample(
          fusion,
          vehicleTelemetryMotionSample({
            timestamp: Date.now(),
            source: "vehicle-telemetry",
            speedKmh: 26,
            accelerationLongitudinal: 0.8,
          }),
          now - 350,
        );
      }
      const motion = tickSensorFusion(fusion, { now, dt: 0.05 });
      peakAccel = Math.max(peakAccel, motion.accelerationMs2);
    }

    expect(peakAccel).toBeGreaterThan(1.1);
    expect(fusion.speedFilteredMs * 3.6).toBeGreaterThan(20);
    expect(fusion.speedFilteredMs * 3.6).toBeLessThan(40);
  });

  it("keeps phone acceleration ahead of lagging telemetry correction", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedAnchorMs = 40 / 3.6;
    fusion.speedFilteredMs = 40 / 3.6;

    pushMotionSample(
      fusion,
      vehicleTelemetryMotionSample({
        timestamp: Date.now(),
        source: "vehicle-telemetry",
        speedKmh: 40,
        accelerationLongitudinal: 0.2,
      }),
      1000,
    );

    let phonePeak = 0;
    for (let i = 0; i < 6; i += 1) {
      const now = 1000 + i * 40;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 40,
          accelerationLongitudinal: 3.1,
          accuracy: 10,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
      phonePeak = Math.max(phonePeak, motion.accelerationMs2);
    }

    pushMotionSample(
      fusion,
      vehicleTelemetryMotionSample({
        timestamp: Date.now(),
        source: "vehicle-telemetry",
        speedKmh: 40,
        accelerationLongitudinal: 0.9,
      }),
      1240,
    );
    const corrected = tickSensorFusion(fusion, { now: 1280, dt: 0.04 });

    expect(phonePeak).toBeGreaterThan(1.4);
    expect(corrected.accelerationMs2).toBeGreaterThan(0.6);
    expect(corrected.accelerationMs2).toBeLessThan(phonePeak + 0.2);
  });

  it("falls back smoothly when telemetry disconnects", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedAnchorMs = 70 / 3.6;
    fusion.speedFilteredMs = 70 / 3.6;

    for (let i = 0; i < 40; i += 1) {
      const now = (i + 1) * 40;
      pushMotionSample(
        fusion,
        vehicleTelemetryMotionSample({
          timestamp: Date.now(),
          source: "vehicle-telemetry",
          speedKmh: 70,
          accelerationLongitudinal: 0.5,
        }),
        now,
      );
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 68,
          accelerationLongitudinal: 0.2,
          accuracy: 10,
        }),
        now,
      );
      tickSensorFusion(fusion, { now, dt: 0.04 });
    }

    markTelemetryRelayLost(fusion, 1700);

    let afterDisconnect = tickSensorFusion(fusion, { now: 2500, dt: 0.04 });
    for (let i = 0; i < 40; i += 1) {
      const now = 2500 + (i + 1) * 40;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 66,
          accelerationLongitudinal: 0.1,
          accuracy: 10,
        }),
        now,
      );
      afterDisconnect = tickSensorFusion(fusion, { now, dt: 0.04 });
    }

    expect(afterDisconnect.sourceHealth.vehicleTelemetry).toBe(false);
    expect(afterDisconnect.primarySource).toBe("phone");
    expect(afterDisconnect.speedKmh).toBeGreaterThan(50);
    expect(afterDisconnect.speedKmh).toBeLessThan(75);
  });

  it("resolves conflicting telemetry and phone GPS without abrupt jumps", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedAnchorMs = 30 / 3.6;
    fusion.speedFilteredMs = 30 / 3.6;

    const speeds: number[] = [];
    for (let i = 0; i < 80; i += 1) {
      const now = (i + 1) * 40;
      pushMotionSample(
        fusion,
        vehicleTelemetryMotionSample({
          timestamp: Date.now(),
          source: "vehicle-telemetry",
          speedKmh: 90,
          accelerationLongitudinal: 0.6,
        }),
        now,
      );
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 32,
          accelerationLongitudinal: 0.2,
          accuracy: 10,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
      speeds.push(motion.speedKmh);
    }

    const maxJump = speeds.slice(5).reduce((max, speed, idx) => {
      return Math.max(max, Math.abs(speed - speeds[idx + 4]!));
    }, 0);

    expect(speeds.at(-1)).toBeGreaterThan(45);
    expect(maxJump).toBeLessThan(4.5);
  });

  it("ignores bad phone GPS when telemetry anchor is healthy", () => {
    const motion = runTicks(100, (i, now, fusion) => {
      pushMotionSample(
        fusion,
        vehicleTelemetryMotionSample({
          timestamp: Date.now(),
          source: "vehicle-telemetry",
          speedKmh: 82,
          accelerationLongitudinal: 0.4,
        }),
        now,
      );
      if (i % 2 === 0) {
        pushMotionSample(
          fusion,
          phoneRelayMotionSample({
            timestamp: Date.now(),
            source: "phone",
            speedKmh: 15,
            accuracy: 90,
          }),
          now,
        );
      }
    });

    expect(motion.primarySource).toBe("vehicle-telemetry");
    expect(motion.speedKmh).toBeGreaterThan(65);
  });

  it("reconnects telemetry with a smooth blend instead of a snap", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedAnchorMs = 55 / 3.6;
    fusion.speedFilteredMs = 55 / 3.6;

    for (let i = 0; i < 30; i += 1) {
      const now = (i + 1) * 40;
      pushMotionSample(
        fusion,
        vehicleTelemetryMotionSample({
          timestamp: Date.now(),
          source: "vehicle-telemetry",
          speedKmh: 55,
        }),
        now,
      );
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 54,
          accuracy: 10,
        }),
        now,
      );
      tickSensorFusion(fusion, { now, dt: 0.04 });
    }

    tickSensorFusion(fusion, { now: 3000, dt: 0.04 });

    const afterGap: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const now = 3000 + (i + 1) * 40;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 52,
          accuracy: 10,
        }),
        now,
      );
      afterGap.push(tickSensorFusion(fusion, { now, dt: 0.04 }).speedKmh);
    }

    pushMotionSample(
      fusion,
      vehicleTelemetryMotionSample({
        timestamp: Date.now(),
        source: "vehicle-telemetry",
        speedKmh: 58,
      }),
      4200,
    );

    const reconnectSpeeds: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const now = 4200 + (i + 1) * 40;
      pushMotionSample(
        fusion,
        vehicleTelemetryMotionSample({
          timestamp: Date.now(),
          source: "vehicle-telemetry",
          speedKmh: 58,
        }),
        now,
      );
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 54,
          accuracy: 10,
        }),
        now,
      );
      reconnectSpeeds.push(tickSensorFusion(fusion, { now, dt: 0.04 }).speedKmh);
    }

    const gapJump = Math.max(
      ...afterGap.slice(1).map((speed, idx) => Math.abs(speed - afterGap[idx]!)),
    );
    const reconnectJump = Math.max(
      ...reconnectSpeeds.slice(1).map((speed, idx) => Math.abs(speed - reconnectSpeeds[idx]!)),
    );

    expect(gapJump).toBeLessThan(3);
    expect(reconnectJump).toBeLessThan(3.5);
    expect(reconnectSpeeds.at(-1)).toBeGreaterThan(52);
  });

  it("uses Tesla browser GPS as the final speed fallback", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedAnchorMs = 45 / 3.6;
    fusion.speedFilteredMs = 45 / 3.6;

    markTelemetryRelayLost(fusion, 500);

    let motion = tickSensorFusion(fusion, { now: 1000, dt: 0.04 });
    for (let i = 0; i < 60; i += 1) {
      const now = 1000 + (i + 1) * 40;
      pushMotionSample(
        fusion,
        browserGpsMotionSample({ speedMs: 48 / 3.6, accuracyM: 12, timestamp: Date.now() }),
        now,
      );
      if (i % 3 === 0) {
        pushMotionSample(fusion, browserImuMotionSample({ accelMs2: 0.15 }), now);
      }
      motion = tickSensorFusion(fusion, { now, dt: 0.04 });
    }

    expect(motion.sourceHealth.vehicleTelemetry).toBe(false);
    expect(motion.sourceHealth.phone).toBe(false);
    expect(motion.primarySource).toBe("tesla-browser");
    expect(motion.speedKmh).toBeGreaterThan(40);
    expect(motion.speedKmh).toBeLessThan(55);
  });
});
