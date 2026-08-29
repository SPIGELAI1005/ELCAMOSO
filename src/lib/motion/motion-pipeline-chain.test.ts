import { describe, expect, it } from "vitest";
import {
  createSensorFusion,
  phoneRelayMotionSample,
  pushMotionSample,
  tickSensorFusion,
} from "@/lib/motion/sensor-fusion";
import { MotionPipelineTracker } from "@/lib/motion/pipeline-metrics";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import type { RelayMotionMessage } from "@/lib/motion/relay-sample";

const DT = 1 / 60;

function relayMessage(
  overrides: Partial<RelayMotionMessage> & { accel?: number; speedKmh?: number } = {},
): RelayMotionMessage {
  const accel = overrides.accel ?? 0.2;
  const speedKmh = overrides.speedKmh ?? 40;
  return {
    type: "motion",
    from: "phone",
    at: overrides.at ?? 1000,
    seq: overrides.seq ?? 1,
    serverAt: overrides.serverAt ?? 1040,
    sample: {
      timestamp: overrides.sample?.timestamp ?? 980,
      source: "phone",
      speedKmh,
      accelerationLongitudinal: accel,
      accuracy: 10,
      ...overrides.sample,
    },
    ...overrides,
  };
}

describe("motion pipeline chain", () => {
  it("reacts to IMU before lagging GPS speed updates throttle", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 11.1;
    fusion.speedAnchorMs = 11.1;

    pushMotionSample(
      fusion,
      phoneRelayMotionSample({
        timestamp: 1000,
        source: "phone",
        speedKmh: 40,
        accelerationLongitudinal: 0.1,
        accuracy: 10,
      }),
      1000,
    );

    let throttleAfterImu = 0;
    for (let i = 0; i < 6; i += 1) {
      const now = 1000 + i * 40;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: now - 15,
          source: "phone",
          speedKmh: 40,
          accelerationLongitudinal: 3.4,
          accuracy: 10,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.04 });
      if (i === 2) throttleAfterImu = motion.inferredThrottle;
    }

    expect(throttleAfterImu).toBeGreaterThan(0.35);
  });

  it("tracks stage timestamps through fusion and powertrain", () => {
    const tracker = new MotionPipelineTracker();
    const fusion = createSensorFusion();
    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });

    const msg = relayMessage({ at: 2000, serverAt: 2060, seq: 4 });
    const receivedAt = 2120;
    tracker.notePhoneRelay(msg, receivedAt);
    pushMotionSample(fusion, phoneRelayMotionSample(msg.sample), receivedAt);

    const fusionAt = 2124;
    const motion = tickSensorFusion(fusion, { now: fusionAt, dt: DT });
    tracker.noteFusion(fusionAt);
    tracker.notePowertrain(fusionAt + 1);
    sim.tick(motion, DT);
    tracker.noteAudio(fusionAt + 2);

    const metrics = tracker.snapshot(fusionAt + 2);
    expect(metrics.latencies.phoneToServerMs).toBe(60);
    expect(metrics.latencies.serverToDisplayMs).toBe(60);
    expect(metrics.latencies.fusionToPowertrainMs).toBe(1);
    expect(metrics.latencies.powertrainToAudioMs).toBe(1);
    expect(metrics.latencies.totalPipelineMs).toBeGreaterThan(140);
  });

  it("degraded relay: IMU keeps throttle responsive while GPS speed is stale", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.speedFilteredMs = 15;
    fusion.speedAnchorMs = 15;

    pushMotionSample(
      fusion,
      phoneRelayMotionSample({
        timestamp: 5000,
        source: "phone",
        speedKmh: 54,
        accelerationLongitudinal: 0.1,
        accuracy: 10,
      }),
      5000,
    );
    tickSensorFusion(fusion, { now: 5000, dt: DT });

    const sim = new PowertrainSimulator({ profileId: "flat-six-sport" });
    let peakLoad = 0;

    for (let i = 0; i < 8; i += 1) {
      const now = 8200 + i * 50;
      pushMotionSample(
        fusion,
        phoneRelayMotionSample({
          timestamp: now - 20,
          source: "phone",
          speedKmh: 54,
          accelerationLongitudinal: 2.8,
          accuracy: 10,
        }),
        now,
      );
      const motion = tickSensorFusion(fusion, { now, dt: 0.05 });
      const pt = sim.tick(motion, 0.05);
      peakLoad = Math.max(peakLoad, pt.load);
    }

    expect(peakLoad).toBeGreaterThan(0.25);
    expect(fusion.bySource.phone).toBeTruthy();
  });

  it("simulates high-latency phone feed as degraded network", () => {
    const tracker = new MotionPipelineTracker();
    for (let i = 0; i < 8; i += 1) {
      const t = i * 200;
      tracker.notePhoneRelay(
        relayMessage({
          seq: i + 1,
          at: t,
          serverAt: t + 220,
          sample: { timestamp: t - 30, source: "phone", speedKmh: 50, accelerationLongitudinal: 1 },
        }),
        t + 380,
      );
    }
    const metrics = tracker.snapshot(2000);
    expect(metrics.networkHealth).not.toBe("live");
    expect(metrics.latencies.endToEndMs ?? 0).toBeGreaterThan(300);
  });
});
