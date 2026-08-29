import { describe, expect, it } from "vitest";
import { createSensorFusion } from "@/lib/motion/sensor-fusion";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";
import { IDLE_PIPELINE_METRICS } from "@/lib/motion/pipeline-metrics";
import { IDLE_STATE } from "@/lib/drive/model";
import { IDLE_PERF } from "@/lib/drive/session";
import { collectDriveDiagnostics } from "@/lib/diagnostics/collect";
import { buildDiagnosticsSessionExport, sanitizeDiagnosticsFrame } from "@/lib/diagnostics/export";

describe("diagnostics export", () => {
  it("strips location fields from exported frames", () => {
    const fusion = createSensorFusion();
    fusion.bySource.phone = {
      sample: {
        timestamp: Date.now(),
        source: "phone",
        speedKmh: 42,
        latitude: 52.52,
        longitude: 13.405,
        heading: 90,
        accuracy: 8,
      },
      receivedAt: performance.now(),
      speedMs: 42 / 3.6,
      previousSpeedMs: null,
      previousReceivedAt: null,
      speedRejected: false,
    };

    const frame = collectDriveDiagnostics({
      sensorFusion: fusion,
      vehicleMotion: IDLE_VEHICLE_MOTION,
      driveState: IDLE_STATE,
      pipeline: IDLE_PIPELINE_METRICS,
      synthesisMode: "dynamic-drive",
      dynamicLayers: [],
      meter: null,
      perf: IDLE_PERF,
    });

    const polluted = {
      ...frame,
      motion: {
        ...frame.motion,
        browserGps: { ...frame.motion.browserGps, latitude: 1, longitude: 2 },
      },
    } as typeof frame & { motion: { browserGps: { latitude: number; longitude: number } } };

    const sanitized = sanitizeDiagnosticsFrame(polluted);
    const json = JSON.stringify(sanitized);
    expect(json).not.toMatch(/latitude|longitude|heading/i);
  });

  it("builds a short session export envelope", () => {
    const fusion = createSensorFusion();
    const frame = collectDriveDiagnostics({
      now: 1000,
      sensorFusion: fusion,
      vehicleMotion: { ...IDLE_VEHICLE_MOTION, timestamp: 1000 },
      driveState: IDLE_STATE,
      pipeline: IDLE_PIPELINE_METRICS,
      synthesisMode: "legacy",
      dynamicLayers: [],
      meter: null,
      perf: IDLE_PERF,
    });

    const payload = buildDiagnosticsSessionExport([frame, { ...frame, at: 2500 }], {
      profileId: "demo",
      profileName: "Demo",
      dynamicDrive: true,
      synthesisMode: "dynamic-drive",
      productStatus: "browser-only",
    });

    expect(payload.kind).toBe("elcamoso.diagnostics.session");
    expect(payload.frameCount).toBe(2);
    expect(payload.durationMs).toBe(1500);
    expect(payload.meta.profileId).toBe("demo");
    expect(payload.frames[0]?.fusion.primarySource).toBeDefined();
  });
});
