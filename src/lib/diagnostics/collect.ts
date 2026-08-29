import type { AudioPerf } from "@/lib/drive/session";
import type { DriveState } from "@/lib/drive/model";
import type { MotionPipelineMetrics } from "@/lib/motion/pipeline-metrics";
import type { SensorFusionState } from "@/lib/motion/sensor-fusion";
import type { VehicleMotionState } from "@/lib/motion/types";
import type { MeterReading } from "@/lib/sound/engine";
import type { DynamicLayerDebugInfo } from "@/lib/sound/dynamic-drive/types";
import type {
  AudioDiagnostics,
  DriveDiagnosticsFrame,
  FusionDiagnostics,
  GpsChannelDiagnostics,
  MotionDiagnostics,
  NetworkDiagnostics,
  PowertrainDiagnostics,
  TeslaTelemetryDiagnostics,
} from "@/lib/diagnostics/types";

const STEADY_LAYER_IDS = new Set([
  "dd-idle",
  "dd-low",
  "dd-mid",
  "dd-high",
  "dd-redline",
  "dd-high-load",
]);

const ACTIVE_GAIN = 0.008;

function readGpsChannel(
  state: SensorFusionState,
  source: "tesla-browser" | "phone",
  now: number,
): GpsChannelDiagnostics {
  const row = state.bySource[source];
  if (!row) {
    return { speedKmh: null, accuracyM: null, ageMs: null, live: false };
  }
  return {
    speedKmh: row.sample.speedKmh ?? null,
    accuracyM: row.sample.accuracy ?? null,
    ageMs: Math.round(now - row.receivedAt),
    live: source === "phone" ? state.sourceHealth.phone : state.sourceHealth.browser,
  };
}

function readTeslaTelemetry(state: SensorFusionState, now: number): TeslaTelemetryDiagnostics {
  const row = state.bySource["vehicle-telemetry"];
  if (!row) {
    return {
      speedKmh: null,
      accelerationMs2: null,
      pedal: null,
      motorRpm: null,
      operatingState: null,
      ageMs: null,
      live: false,
    };
  }
  return {
    speedKmh: row.sample.speedKmh ?? null,
    accelerationMs2: row.sample.accelerationLongitudinal ?? null,
    pedal: row.sample.pedalPosition ?? null,
    motorRpm: row.sample.motorAxleSpeedRpm ?? null,
    operatingState: row.sample.vehicleOperatingState ?? null,
    ageMs: Math.round(now - row.receivedAt),
    live: state.sourceHealth.vehicleTelemetry,
  };
}

function readMotion(state: SensorFusionState, now: number): MotionDiagnostics {
  return {
    browserGps: readGpsChannel(state, "tesla-browser", now),
    phoneGps: readGpsChannel(state, "phone", now),
    accelerationRawMs2: state.accelTransientMs2,
    accelerationFilteredMs2: state.accelFilteredMs2,
    teslaTelemetry: readTeslaTelemetry(state, now),
  };
}

function readFusion(
  state: SensorFusionState,
  vehicleMotion: VehicleMotionState,
): FusionDiagnostics {
  return {
    speedKmh: vehicleMotion.speedKmh,
    accelerationMs2: vehicleMotion.accelerationMs2,
    confidence: vehicleMotion.motionConfidence,
    primarySource: state.primarySource,
    fallbackTier: vehicleMotion.fallbackTier,
    transitioning: vehicleMotion.transitioning,
  };
}

function readPowertrain(driveState: DriveState): PowertrainDiagnostics {
  const pt = driveState.powertrain;
  return {
    throttle: pt?.throttle ?? driveState.throttle,
    load: pt?.load ?? driveState.load,
    gear: pt?.gear ?? driveState.gear,
    targetGear: pt?.targetGear ?? null,
    rpm: pt?.rpm ?? driveState.rpm,
    shifting: pt?.shifting ?? driveState.isShifting,
    shiftDirection: pt?.shiftDirection ?? null,
    drivingMode: pt?.drivingMode ?? null,
  };
}

function layerRow(info: DynamicLayerDebugInfo): AudioDiagnostics["activeLayers"][number] {
  return {
    id: info.id,
    gain: info.gain,
    playbackRate: info.playbackRate,
    fundamentalHz: info.fundamentalHz,
  };
}

function readAudio(input: {
  synthesisMode: string;
  dynamicLayers: DynamicLayerDebugInfo[];
  meter: MeterReading | null;
  perf: AudioPerf;
}): AudioDiagnostics {
  const allLayers = input.dynamicLayers.map(layerRow);
  const active = allLayers.filter((row) => row.gain >= ACTIVE_GAIN);
  const transients = active.filter((row) => !STEADY_LAYER_IDS.has(row.id));
  const steady = active.filter((row) => STEADY_LAYER_IDS.has(row.id));

  return {
    synthesisMode: input.synthesisMode,
    dynamicLayers: allLayers,
    activeLayers: steady.length ? steady : active,
    transients,
    master: input.meter
      ? {
          peak: input.meter.peak,
          rms: input.meter.rms,
          headroom: input.meter.headroom,
          reduction: input.meter.reduction,
          underruns: input.perf.underruns,
          outputLatencyMs: Number.isFinite(input.perf.outputLatencyMs)
            ? input.perf.outputLatencyMs
            : null,
        }
      : null,
  };
}

function readNetwork(pipeline: MotionPipelineMetrics): NetworkDiagnostics {
  return {
    phoneLatencyMs: pipeline.phoneLatencyMs,
    vehicleLatencyMs: pipeline.vehicleLatencyMs,
    phonePacketRateHz: pipeline.phoneSendHz,
    vehiclePacketRateHz: pipeline.vehiclePacketRateHz,
    packetLoss: pipeline.packetLossCount,
    reconnectCount: pipeline.reconnectCount,
    networkHealth: pipeline.networkHealth,
  };
}

export function collectDriveDiagnostics(input: {
  now?: number;
  sensorFusion: SensorFusionState;
  vehicleMotion: VehicleMotionState;
  driveState: DriveState;
  pipeline: MotionPipelineMetrics;
  synthesisMode: string;
  dynamicLayers: DynamicLayerDebugInfo[];
  meter: MeterReading | null;
  perf: AudioPerf;
}): DriveDiagnosticsFrame {
  const now = input.now ?? performance.now();
  return {
    at: Math.round(now),
    motion: readMotion(input.sensorFusion, now),
    fusion: readFusion(input.sensorFusion, input.vehicleMotion),
    powertrain: readPowertrain(input.driveState),
    audio: readAudio({
      synthesisMode: input.synthesisMode,
      dynamicLayers: input.dynamicLayers,
      meter: input.meter,
      perf: input.perf,
    }),
    network: readNetwork(input.pipeline),
  };
}
