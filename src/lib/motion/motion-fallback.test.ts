import { describe, expect, it } from "vitest";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import {
  browserGpsMotionSample,
  createSensorFusion,
  markPhoneRelayLost,
  markPhoneRelayRestored,
  phoneRelayMotionSample,
  pushMotionSample,
  tickSensorFusion,
} from "@/lib/motion/sensor-fusion";
import {
  RECONNECT_BLEND_MS,
  resolveFallbackAccel,
  resolveFallbackSpeed,
  resolveFallbackTier,
  SIGNAL_HOLD_MS,
} from "@/lib/motion/motion-fallback";

const DT = 1 / 60;

describe("motion fallback hierarchy", () => {
  it("prefers telemetry over phone over browser", () => {
    expect(
      resolveFallbackTier({
        freshness: {
          telemetryAgeMs: 100,
          phoneAgeMs: 100,
          browserAgeMs: 100,
          phoneImuAgeMs: 100,
          browserImuAgeMs: 100,
        },
        phoneSuspended: false,
        now: 5000,
        lastAnySourceAt: 4900,
        telemetryStaleMs: 1200,
        phoneStaleMs: 2800,
        browserStaleMs: 5000,
      }),
    ).toBe("vehicle-telemetry");

    expect(
      resolveFallbackTier({
        freshness: {
          telemetryAgeMs: 5000,
          phoneAgeMs: 200,
          browserAgeMs: 200,
          phoneImuAgeMs: 200,
          browserImuAgeMs: 200,
        },
        phoneSuspended: false,
        now: 5000,
        lastAnySourceAt: 4900,
        telemetryStaleMs: 1200,
        phoneStaleMs: 2800,
        browserStaleMs: 5000,
      }),
    ).toBe("phone");

    expect(
      resolveFallbackTier({
        freshness: {
          telemetryAgeMs: null,
          phoneAgeMs: 5000,
          browserAgeMs: 200,
          phoneImuAgeMs: null,
          browserImuAgeMs: 200,
        },
        phoneSuspended: true,
        now: 5000,
        lastAnySourceAt: 4900,
        telemetryStaleMs: 1200,
        phoneStaleMs: 2800,
        browserStaleMs: 5000,
      }),
    ).toBe("browser");
  });

  it("enters hold tier during brief gaps then decays safely", () => {
    const now = 10_000;
    const holdTier = resolveFallbackTier({
      freshness: {
        telemetryAgeMs: null,
        phoneAgeMs: null,
        browserAgeMs: null,
        phoneImuAgeMs: null,
        browserImuAgeMs: null,
      },
      phoneSuspended: false,
      now,
      lastAnySourceAt: now - SIGNAL_HOLD_MS + 200,
      telemetryStaleMs: 1200,
      phoneStaleMs: 2800,
      browserStaleMs: 5000,
    });
    expect(holdTier).toBe("hold");

    const decayTier = resolveFallbackTier({
      freshness: {
        telemetryAgeMs: null,
        phoneAgeMs: null,
        browserAgeMs: null,
        phoneImuAgeMs: null,
        browserImuAgeMs: null,
      },
      phoneSuspended: false,
      now,
      lastAnySourceAt: now - SIGNAL_HOLD_MS - 500,
      telemetryStaleMs: 1200,
      phoneStaleMs: 2800,
      browserStaleMs: 5000,
    });
    expect(decayTier).toBe("decay");
  });

  it("holds speed and accel briefly instead of collapsing to zero", () => {
    const speed = resolveFallbackSpeed({
      tier: "hold",
      candidateSpeedMs: null,
      currentSpeedMs: 20,
      holdSpeedMs: 22,
      imuAccelMs2: null,
      dt: 0.05,
      tierBlend: 1,
    });
    expect(speed).toBeGreaterThan(19);

    const accel = resolveFallbackAccel({
      tier: "hold",
      imuAccelMs2: null,
      currentAccelMs2: 1.8,
      holdAccelMs2: 2,
      dt: 0.05,
    });
    expect(accel).toBeGreaterThan(1.5);
  });

  it("falls back from phone to browser without speed cliff", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 25;
    fusion.speedAnchorMs = 25;

    for (let i = 0; i < 90; i += 1) {
      const now = (i + 1) * DT * 1000;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 90,
          accelerationLongitudinal: 0.4,
          accuracy: 8,
        }),
        now,
      );
      tickSensorFusion(fusion, { now, dt: DT });
    }

    markPhoneRelayLost(fusion);
    let afterLoss = tickSensorFusion(fusion, { now: 2000, dt: DT });
    expect(afterLoss.fallbackTier).toBe("hold");
    expect(afterLoss.speedKmh).toBeGreaterThan(70);

    for (let i = 0; i < 60; i += 1) {
      const now = 2000 + (i + 1) * DT * 1000;
      pushMotionSample(fusion, browserGpsMotionSample({ speedMs: 88 / 3.6, accuracyM: 10 }), now);
      afterLoss = tickSensorFusion(fusion, { now, dt: DT });
    }

    expect(afterLoss.fallbackTier).toBe("browser");
    expect(afterLoss.speedKmh).toBeGreaterThan(60);
  });

  it("limits RPM jump after phone reconnect", () => {
    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 30;
    fusion.speedAnchorMs = 30;

    let rpm = 0;
    for (let i = 0; i < 120; i += 1) {
      const now = (i + 1) * 16;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 108,
          accelerationLongitudinal: 0.5,
          accuracy: 8,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.016 });
      rpm = sim.tick(motion, 0.016).rpm;
    }

    markPhoneRelayLost(fusion);
    for (let i = 0; i < 40; i += 1) {
      const now = 2000 + i * 16;
      const motion = tickSensorFusion(fusion, { now, dt: 0.016 });
      rpm = sim.tick(motion, 0.016).rpm;
    }

    markPhoneRelayRestored(fusion);
    let maxJump = 0;
    let prevRpm = rpm;
    for (let i = 0; i < 80; i += 1) {
      const now = 3000 + i * 16;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: Date.now(),
          source: "phone",
          speedKmh: 110,
          accelerationLongitudinal: 1.2,
          accuracy: 8,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.016 });
      const next = sim.tick(motion, 0.016);
      maxJump = Math.max(maxJump, Math.abs(next.rpm - prevRpm));
      prevRpm = next.rpm;
    }

    expect(maxJump).toBeLessThan(900);
  });
});
