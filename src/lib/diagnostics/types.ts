import type { SensorSource, MotionFallbackTier } from "@/lib/motion/types";
import type { PipelineNetworkHealth } from "@/lib/motion/pipeline-metrics";

export interface GpsChannelDiagnostics {
  speedKmh: number | null;
  accuracyM: number | null;
  ageMs: number | null;
  live: boolean;
}

export interface TeslaTelemetryDiagnostics {
  speedKmh: number | null;
  accelerationMs2: number | null;
  pedal: number | null;
  motorRpm: number | null;
  operatingState: string | null;
  ageMs: number | null;
  live: boolean;
}

export interface MotionDiagnostics {
  browserGps: GpsChannelDiagnostics;
  phoneGps: GpsChannelDiagnostics;
  /** Phone or browser IMU longitudinal accel before fusion filtering. */
  accelerationRawMs2: number;
  /** Fused longitudinal accel after filtering. */
  accelerationFilteredMs2: number;
  teslaTelemetry: TeslaTelemetryDiagnostics;
}

export interface FusionDiagnostics {
  speedKmh: number;
  accelerationMs2: number;
  confidence: number;
  primarySource: SensorSource;
  fallbackTier: MotionFallbackTier;
  transitioning: boolean;
  inputAgeMs: number | null;
  speedProvenance: "measured" | "estimated" | "simulated";
  accelerationProvenance: "measured" | "estimated" | "simulated";
}

export interface PowertrainDiagnostics {
  /** Explicit backend - never confuse Legacy Mode with Dynamic Drive in tests. */
  powertrainBackend: "legacy" | "dynamic";
  throttle: number;
  load: number;
  driverDemand: number | null;
  engineLoad: number | null;
  gear: number;
  targetGear: number | null;
  queuedTargetGear: number | null;
  rpm: number;
  mechanicalRpm: number | null;
  shifting: boolean;
  shiftDirection: string | null;
  shiftPhase: string | null;
  shiftProgress: number | null;
  lastShiftReason: string | null;
  rawSpeedKmh: number | null;
  displaySpeedKmh: number | null;
  mechanicalSpeedKmh: number | null;
  shiftDecisionSpeedKmh: number | null;
  braking: number | null;
  motionSource: string | null;
  fallbackTier: string | null;
  drivingMode: string | null;
  valueProvenance: "estimated" | "simulated";
  boost: number | null;
  boostProvenance: "simulated" | "unavailable";
}

export interface AudioLayerDiagnostics {
  id: string;
  gain: number;
  playbackRate: number;
  fundamentalHz: number | null;
}

export interface AudioDiagnostics {
  backend: string;
  recordedSampleBank: "active" | "not-shipped" | "not-applicable";
  sampleState: string | null;
  sampleFallbackReason: string | null;
  synthesisMode: string;
  /** Full Dynamic Drive layer telemetry when motion-matched audio is active. */
  dynamicLayers: AudioLayerDiagnostics[];
  activeLayers: AudioLayerDiagnostics[];
  transients: AudioLayerDiagnostics[];
  master: {
    prePeak: number;
    preRms: number;
    peak: number;
    rms: number;
    headroom: number;
    reduction: number;
    compressorReduction: number;
    underruns: number;
    /** Estimated output latency (ms). */
    outputLatencyMs: number | null;
  } | null;
  gains: {
    userVolume: number;
    profileGain: number;
    loudnessTrim: number;
    loadScale: number;
    effectiveMasterTarget: number;
    masterNode: number;
    duck: number;
    body: number;
    accents: number;
    beds: number;
    wet: number;
    profileBusOutput: number;
  } | null;
}

export interface NetworkDiagnostics {
  phoneLatencyMs: number | null;
  vehicleLatencyMs: number | null;
  phonePacketRateHz: number;
  vehiclePacketRateHz: number;
  packetLoss: number;
  reconnectCount: number;
  networkHealth: PipelineNetworkHealth;
}

export interface DriveDiagnosticsFrame {
  at: number;
  motion: MotionDiagnostics;
  fusion: FusionDiagnostics;
  powertrain: PowertrainDiagnostics;
  audio: AudioDiagnostics;
  network: NetworkDiagnostics;
}

export const DIAGNOSTICS_SESSION_KIND = "elcamoso.diagnostics.session" as const;

export interface DiagnosticsSessionExport {
  kind: typeof DIAGNOSTICS_SESSION_KIND;
  exportedAt: string;
  durationMs: number;
  frameCount: number;
  /** Session context - no location fields. */
  meta: DiagnosticsSessionMeta;
  frames: DriveDiagnosticsFrame[];
}

export interface DiagnosticsSessionMeta {
  profileId: string;
  profileName: string;
  dynamicDrive: boolean;
  synthesisMode: string;
  productStatus: string;
}
