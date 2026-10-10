import type { AudioPerf } from "@/lib/drive/session";
import type { DriveState } from "@/lib/drive/model";
import type { MotionPipelineMetrics } from "@/lib/motion/pipeline-metrics";
import type { SensorFusionState } from "@/lib/motion/sensor-fusion";
import type { VehicleMotionState } from "@/lib/motion/types";
import type { MeterReading, SoundGainDiagnostics } from "@/lib/sound/engine";
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
  now: number,
): FusionDiagnostics {
  const sourceRow = state.bySource[state.primarySource];
  const simulated = String(state.primarySource) === "simulator";
  const telemetryAccel = state.bySource["vehicle-telemetry"]?.sample.accelerationLongitudinal;
  return {
    speedKmh: vehicleMotion.speedKmh,
    accelerationMs2: vehicleMotion.accelerationMs2,
    confidence: vehicleMotion.motionConfidence,
    primarySource: state.primarySource,
    fallbackTier: vehicleMotion.fallbackTier,
    transitioning: vehicleMotion.transitioning,
    inputAgeMs: sourceRow ? Math.max(0, Math.round(now - sourceRow.receivedAt)) : null,
    speedProvenance: simulated ? "simulated" : vehicleMotion.fallbackTier === "hold" ? "estimated" : "measured",
    accelerationProvenance: simulated ? "simulated" : telemetryAccel != null ? "measured" : "estimated",
  };
}

function readPowertrain(driveState: DriveState): PowertrainDiagnostics {
  const pt = driveState.powertrain;
  const backend = driveState.powertrainBackend ?? (pt ? "dynamic" : "legacy");
  return {
    powertrainBackend: backend,
    throttle: pt?.throttle ?? driveState.throttle,
    load: pt?.load ?? driveState.load,
    driverDemand: pt?.driverDemand ?? null,
    engineLoad: pt?.engineLoad ?? null,
    gear: pt?.gear ?? driveState.gear,
    targetGear: pt?.targetGear ?? null,
    queuedTargetGear: pt?.queuedTargetGear ?? null,
    rpm: pt?.rpm ?? driveState.rpm,
    mechanicalRpm: pt?.mechanicalRpm ?? null,
    shifting: pt?.shifting ?? driveState.isShifting,
    shiftDirection: pt?.shiftDirection ?? null,
    shiftPhase: pt?.shiftPhase ?? null,
    shiftProgress: pt?.shiftProgress ?? null,
    lastShiftReason: pt?.lastShiftReason ?? null,
    rawSpeedKmh: pt?.diagnostics?.rawSpeedKmh ?? null,
    displaySpeedKmh: pt?.diagnostics?.displaySpeedKmh ?? null,
    mechanicalSpeedKmh: pt?.diagnostics?.mechanicalSpeedKmh ?? null,
    shiftDecisionSpeedKmh: pt?.diagnostics?.shiftDecisionSpeedKmh ?? null,
    braking: pt?.diagnostics?.braking ?? null,
    motionSource: pt?.diagnostics?.motionSource ?? null,
    fallbackTier: pt?.diagnostics?.fallbackTier ?? null,
    drivingMode: pt?.drivingMode ?? null,
    valueProvenance: pt?.diagnostics?.motionSource === "simulator" ? "simulated" : "estimated",
    boost: pt?.boost ?? null,
    boostProvenance: pt ? "simulated" : "unavailable",
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
  backend: string;
  sampleState?: string | null;
  sampleFallbackReason?: string | null;
  synthesisMode: string;
  dynamicLayers: DynamicLayerDebugInfo[];
  meter: MeterReading | null;
  perf: AudioPerf;
  gains: SoundGainDiagnostics | null;
}): AudioDiagnostics {
  const allLayers = input.dynamicLayers.map(layerRow);
  const active = allLayers.filter((row) => row.gain >= ACTIVE_GAIN);
  const transients = active.filter((row) => !STEADY_LAYER_IDS.has(row.id));
  const steady = active.filter((row) => STEADY_LAYER_IDS.has(row.id));

  return {
    backend: input.backend,
    recordedSampleBank: allLayers.some((row) => row.id === "v2-recorded-samples")
      ? "active"
      : input.backend.startsWith("realism-v2")
        ? "not-shipped"
        : "not-applicable",
    sampleState: input.sampleState ?? null,
    sampleFallbackReason: input.sampleFallbackReason ?? null,
    synthesisMode: input.synthesisMode,
    dynamicLayers: allLayers,
    activeLayers: steady.length ? steady : active,
    transients,
    master: input.meter
      ? {
          prePeak: input.meter.prePeak,
          preRms: input.meter.preRms,
          peak: input.meter.peak,
          rms: input.meter.rms,
          headroom: input.meter.headroom,
          reduction: input.meter.reduction,
          compressorReduction: input.meter.compressorReduction,
          underruns: input.perf.underruns,
          outputLatencyMs: Number.isFinite(input.perf.outputLatencyMs)
            ? input.perf.outputLatencyMs
            : null,
        }
      : null,
    gains: input.gains,
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
  backend?: string;
  sampleState?: string | null;
  sampleFallbackReason?: string | null;
  dynamicLayers: DynamicLayerDebugInfo[];
  meter: MeterReading | null;
  perf: AudioPerf;
  gains?: SoundGainDiagnostics | null;
}): DriveDiagnosticsFrame {
  const now = input.now ?? performance.now();
  return {
    at: Math.round(now),
    motion: readMotion(input.sensorFusion, now),
    fusion: readFusion(input.sensorFusion, input.vehicleMotion, now),
    powertrain: readPowertrain(input.driveState),
    audio: readAudio({
      synthesisMode: input.synthesisMode,
      backend: input.backend ?? input.synthesisMode,
      sampleState: input.sampleState ?? null,
      sampleFallbackReason: input.sampleFallbackReason ?? null,
      dynamicLayers: input.dynamicLayers,
      meter: input.meter,
      perf: input.perf,
      gains: input.gains ?? null,
    }),
    network: readNetwork(input.pipeline),
  };
}
