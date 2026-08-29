import { describe, expect, it } from "vitest";
import { createSensorFusion } from "@/lib/motion/sensor-fusion";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";
import { IDLE_PIPELINE_METRICS } from "@/lib/motion/pipeline-metrics";
import { IDLE_STATE } from "@/lib/drive/model";
import { IDLE_PERF } from "@/lib/drive/session";
import { collectDriveDiagnostics } from "@/lib/diagnostics/collect";
import { DiagnosticsSessionRecorder } from "@/lib/diagnostics/recorder";

describe("collectDriveDiagnostics", () => {
  it("maps motion, fusion, powertrain, audio and network sections", () => {
    const fusion = createSensorFusion();
    fusion.initialized = true;
    fusion.primarySource = "vehicle-telemetry";
    fusion.accelTransientMs2 = 1.2;
    fusion.accelFilteredMs2 = 0.8;
    fusion.bySource["vehicle-telemetry"] = {
      sample: {
        timestamp: Date.now(),
        source: "vehicle-telemetry",
        speedKmh: 72,
        accelerationLongitudinal: 0.9,
        pedalPosition: 0.42,
      },
      receivedAt: performance.now(),
      speedMs: 20,
      previousSpeedMs: null,
      previousReceivedAt: null,
      speedRejected: false,
    };

    const frame = collectDriveDiagnostics({
      sensorFusion: fusion,
      vehicleMotion: {
        ...IDLE_VEHICLE_MOTION,
        speedKmh: 71,
        accelerationMs2: 0.75,
        motionConfidence: 0.88,
        primarySource: "vehicle-telemetry",
      },
      driveState: {
        ...IDLE_STATE,
        powertrain: {
          rpm: 4200,
          normalizedRpm: 0.62,
          gear: 4,
          targetGear: 4,
          load: 0.55,
          throttle: 0.48,
          shifting: false,
          shiftDirection: null,
          shiftProgress: 0,
          revMatchActive: false,
          revMatchProgress: 0,
          overrun: false,
          drivingMode: "sport",
          engineRunning: true,
          timestamp: Date.now(),
        },
      },
      pipeline: {
        ...IDLE_PIPELINE_METRICS,
        phoneLatencyMs: 42,
        vehicleLatencyMs: 180,
        phoneSendHz: 12,
        vehiclePacketRateHz: 0.5,
        packetLossCount: 2,
        reconnectCount: 1,
      },
      synthesisMode: "dynamic-drive",
      dynamicLayers: [
        { id: "dd-mid", gain: 0.12, playbackRate: 1.05, fundamentalHz: 220 },
        { id: "dd-exhaust-pop", gain: 0.02, playbackRate: 1.2, fundamentalHz: 80 },
      ],
      meter: { peak: 0.42, rms: 0.18, headroom: 0.58, reduction: 0.01 },
      perf: { ...IDLE_PERF, outputLatencyMs: 28, underruns: 1 },
    });

    expect(frame.motion.teslaTelemetry.speedKmh).toBe(72);
    expect(frame.motion.accelerationRawMs2).toBe(1.2);
    expect(frame.fusion.speedKmh).toBe(71);
    expect(frame.fusion.primarySource).toBe("vehicle-telemetry");
    expect(frame.powertrain.rpm).toBe(4200);
    expect(frame.audio.activeLayers.some((row) => row.id === "dd-mid")).toBe(true);
    expect(frame.audio.transients.some((row) => row.id === "dd-exhaust-pop")).toBe(true);
    expect(frame.audio.master?.outputLatencyMs).toBe(28);
    expect(frame.network.phoneLatencyMs).toBe(42);
    expect(frame.network.reconnectCount).toBe(1);
  });
});

describe("DiagnosticsSessionRecorder", () => {
  it("records at most 2 Hz and caps the ring buffer", () => {
    const recorder = new DiagnosticsSessionRecorder();
    const fusion = createSensorFusion();
    const frame = () =>
      collectDriveDiagnostics({
        sensorFusion: fusion,
        vehicleMotion: IDLE_VEHICLE_MOTION,
        driveState: IDLE_STATE,
        pipeline: IDLE_PIPELINE_METRICS,
        synthesisMode: "legacy",
        dynamicLayers: [],
        meter: null,
        perf: IDLE_PERF,
      });

    recorder.record(frame(), 1000);
    recorder.record(frame(), 1200);
    recorder.record(frame(), 1600);
    expect(recorder.snapshot()).toHaveLength(2);

    for (let i = 0; i < 80; i += 1) {
      recorder.record(frame(), 2000 + i * 600);
    }
    expect(recorder.snapshot().length).toBeLessThanOrEqual(60);
  });
});
