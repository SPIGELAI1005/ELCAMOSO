import { describe, expect, it } from "vitest";
import {
  MotionPipelineTracker,
  computePipelineLatencies,
  resolveNetworkHealth,
} from "@/lib/motion/pipeline-metrics";
import type { RelayMotionMessage } from "@/lib/motion/relay-sample";

function motionMessage(overrides: Partial<RelayMotionMessage> = {}): RelayMotionMessage {
  return {
    type: "motion",
    from: "phone",
    at: 1000,
    seq: 1,
    serverAt: 1040,
    sample: {
      timestamp: 980,
      source: "phone",
      speedKmh: 52,
      accelerationLongitudinal: 1.4,
      accuracy: 10,
    },
    ...overrides,
  };
}

describe("MotionPipelineTracker", () => {
  it("computes stage latencies from timestamps", () => {
    const tracker = new MotionPipelineTracker();
    tracker.notePhoneRelay(motionMessage(), 1080);
    tracker.noteFusion(1085);
    tracker.notePowertrain(1086);
    tracker.noteAudio(1087);

    const metrics = tracker.snapshot(1087);
    expect(metrics.latencies.sensorSamplingMs).toBe(20);
    expect(metrics.latencies.phoneToServerMs).toBe(40);
    expect(metrics.latencies.serverToDisplayMs).toBe(40);
    expect(metrics.latencies.displayToFusionMs).toBe(5);
    expect(metrics.latencies.fusionToPowertrainMs).toBe(1);
    expect(metrics.latencies.powertrainToAudioMs).toBe(1);
    expect(metrics.latencies.endToEndMs).toBe(100);
    expect(metrics.latencies.totalPipelineMs).toBe(107);
  });

  it("marks degraded network when end-to-end latency is high", () => {
    const health = resolveNetworkHealth({
      phoneSendHz: 12,
      endToEndMs: 520,
      displayAgeMs: 200,
    });
    expect(health).toBe("degraded");
  });

  it("marks stale when display feed stops", () => {
    const health = resolveNetworkHealth({
      phoneSendHz: 0,
      endToEndMs: 200,
      displayAgeMs: 3200,
    });
    expect(health).toBe("stale");
  });

  it("tracks send rate over a one-second window", () => {
    const tracker = new MotionPipelineTracker();
    for (let i = 0; i < 12; i += 1) {
      tracker.notePhoneRelay(motionMessage({ seq: i + 1, at: 1000 + i * 80 }), 1040 + i * 80);
    }
    expect(tracker.snapshot(2000).phoneSendHz).toBe(12);
  });

  it("suggests latency compensation from end-to-end delay", () => {
    const tracker = new MotionPipelineTracker();
    tracker.notePhoneRelay(motionMessage({ at: 1000, serverAt: 1060 }), 1120);
    expect(tracker.suggestedLatencyCompMs()).toBeGreaterThan(40);
  });
});

describe("computePipelineLatencies", () => {
  it("returns null deltas when timestamps are missing", () => {
    const latencies = computePipelineLatencies({
      sensorSampleAt: null,
      phoneSentAt: null,
      serverRelayAt: null,
      displayReceivedAt: null,
      fusionAt: null,
      powertrainAt: null,
      audioAt: null,
    });
    expect(latencies.totalPipelineMs).toBeNull();
  });
});

describe("degraded network simulation", () => {
  it("keeps fusion and audio cadence while phone feed slows", () => {
    const phoneTracker = new MotionPipelineTracker();
    const localTracker = new MotionPipelineTracker();

    for (let i = 0; i < 30; i += 1) {
      const t = i * 120;
      if (i % 3 === 0) {
        phoneTracker.notePhoneRelay(
          motionMessage({
            seq: i + 1,
            at: t,
            serverAt: t + 180,
            sample: {
              ...motionMessage().sample,
              timestamp: t - 20,
              accelerationLongitudinal: 2.2,
            },
          }),
          t + 260,
        );
      }
      localTracker.noteFusion(t + 270);
      localTracker.notePowertrain(t + 271);
      localTracker.noteAudio(t + 272);
    }

    const phoneMetrics = phoneTracker.snapshot(3600);
    expect(phoneMetrics.phoneSendHz).toBeLessThan(12);
    expect(phoneMetrics.networkHealth).not.toBe("live");

    const localMetrics = localTracker.snapshot(3600);
    expect(localMetrics.fusionHz).toBeGreaterThan(8);
    expect(localMetrics.audioHz).toBeGreaterThan(8);
  });
});
