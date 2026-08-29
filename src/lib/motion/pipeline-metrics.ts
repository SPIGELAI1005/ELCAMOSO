import type { RelayMotionMessage } from "@/lib/motion/relay-sample";
import type { RelayTelemetryMessage } from "@/lib/motion/relay-telemetry";
import type { MotionFallbackTier } from "@/lib/motion/types";

export type PipelineNetworkHealth = "live" | "degraded" | "stale" | "offline";

export interface MotionPipelineTimestamps {
  sensorSampleAt: number | null;
  phoneSentAt: number | null;
  serverRelayAt: number | null;
  displayReceivedAt: number | null;
  fusionAt: number | null;
  powertrainAt: number | null;
  audioAt: number | null;
}

export interface MotionPipelineLatencies {
  sensorSamplingMs: number | null;
  phoneToServerMs: number | null;
  serverToDisplayMs: number | null;
  displayToFusionMs: number | null;
  fusionToPowertrainMs: number | null;
  powertrainToAudioMs: number | null;
  endToEndMs: number | null;
  totalPipelineMs: number | null;
}

export interface MotionPipelineMetrics {
  timestamps: MotionPipelineTimestamps;
  latencies: MotionPipelineLatencies;
  phoneSendHz: number;
  fusionHz: number;
  audioHz: number;
  networkHealth: PipelineNetworkHealth;
  seq: number | null;
  fallbackTier: MotionFallbackTier | null;
  /** Phone relay end-to-end latency (sensor sample → display). */
  phoneLatencyMs: number | null;
  /** Vehicle telemetry sample → display latency. */
  vehicleLatencyMs: number | null;
  vehiclePacketRateHz: number;
  packetLossCount: number;
  reconnectCount: number;
}

export const IDLE_PIPELINE_METRICS: MotionPipelineMetrics = {
  timestamps: {
    sensorSampleAt: null,
    phoneSentAt: null,
    serverRelayAt: null,
    displayReceivedAt: null,
    fusionAt: null,
    powertrainAt: null,
    audioAt: null,
  },
  latencies: {
    sensorSamplingMs: null,
    phoneToServerMs: null,
    serverToDisplayMs: null,
    displayToFusionMs: null,
    fusionToPowertrainMs: null,
    powertrainToAudioMs: null,
    endToEndMs: null,
    totalPipelineMs: null,
  },
  phoneSendHz: 0,
  fusionHz: 0,
  audioHz: 0,
  networkHealth: "offline",
  seq: null,
  fallbackTier: null,
  phoneLatencyMs: null,
  vehicleLatencyMs: null,
  vehiclePacketRateHz: 0,
  packetLossCount: 0,
  reconnectCount: 0,
};

function diffMs(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, b - a);
}

export function computePipelineLatencies(ts: MotionPipelineTimestamps): MotionPipelineLatencies {
  return {
    sensorSamplingMs: diffMs(ts.sensorSampleAt, ts.phoneSentAt),
    phoneToServerMs: diffMs(ts.phoneSentAt, ts.serverRelayAt),
    serverToDisplayMs: diffMs(ts.serverRelayAt, ts.displayReceivedAt),
    displayToFusionMs: diffMs(ts.displayReceivedAt, ts.fusionAt),
    fusionToPowertrainMs: diffMs(ts.fusionAt, ts.powertrainAt),
    powertrainToAudioMs: diffMs(ts.powertrainAt, ts.audioAt),
    endToEndMs: diffMs(ts.sensorSampleAt, ts.displayReceivedAt),
    totalPipelineMs: diffMs(ts.sensorSampleAt, ts.audioAt),
  };
}

export function resolveNetworkHealth(input: {
  phoneSendHz: number;
  endToEndMs: number | null;
  displayAgeMs: number | null;
}): PipelineNetworkHealth {
  if (input.phoneSendHz <= 0 && (input.displayAgeMs ?? Infinity) > 4000) return "offline";
  if ((input.displayAgeMs ?? Infinity) > 2800 || (input.endToEndMs ?? 0) > 900) return "stale";
  if ((input.endToEndMs ?? 0) > 320 || input.phoneSendHz < 8) return "degraded";
  return "live";
}

export class MotionPipelineTracker {
  private timestamps: MotionPipelineTimestamps = { ...IDLE_PIPELINE_METRICS.timestamps };
  private phoneSends: number[] = [];
  private vehicleSends: number[] = [];
  private fusionTicks: number[] = [];
  private audioTicks: number[] = [];
  private lastDisplayAt: number | null = null;
  private seq: number | null = null;
  private phoneSeqLast: number | null = null;
  private packetLossCount = 0;
  private reconnectCount = 0;
  private lastVehicleLatencyMs: number | null = null;

  reset() {
    this.timestamps = { ...IDLE_PIPELINE_METRICS.timestamps };
    this.phoneSends = [];
    this.vehicleSends = [];
    this.fusionTicks = [];
    this.audioTicks = [];
    this.lastDisplayAt = null;
    this.seq = null;
    this.phoneSeqLast = null;
    this.packetLossCount = 0;
    this.reconnectCount = 0;
    this.lastVehicleLatencyMs = null;
  }

  noteReconnect() {
    this.reconnectCount += 1;
  }

  notePhoneRelay(message: RelayMotionMessage, displayReceivedAt = performance.now()) {
    this.timestamps.sensorSampleAt = message.sample.timestamp;
    this.timestamps.phoneSentAt = message.at;
    this.timestamps.serverRelayAt = message.serverAt ?? null;
    this.timestamps.displayReceivedAt = displayReceivedAt;
    this.lastDisplayAt = displayReceivedAt;
    this.seq = message.seq;

    if (this.phoneSeqLast !== null && message.seq > this.phoneSeqLast + 1) {
      this.packetLossCount += message.seq - this.phoneSeqLast - 1;
    }
    this.phoneSeqLast = message.seq;

    const t = displayReceivedAt;
    this.phoneSends.push(t);
    this.phoneSends = this.phoneSends.filter((x) => t - x < 1000);
  }

  noteVehicleTelemetry(message: RelayTelemetryMessage, displayReceivedAt = performance.now()) {
    this.timestamps.sensorSampleAt = message.record.receivedAt;
    this.timestamps.serverRelayAt = message.serverAt ?? message.at;
    this.timestamps.displayReceivedAt = displayReceivedAt;
    this.lastDisplayAt = displayReceivedAt;
    this.lastVehicleLatencyMs = Math.max(0, displayReceivedAt - message.record.receivedAt);
    this.seq = message.seq;

    const t = displayReceivedAt;
    this.vehicleSends.push(t);
    this.vehicleSends = this.vehicleSends.filter((x) => t - x < 1000);
  }

  noteFusion(at = performance.now()) {
    this.timestamps.fusionAt = at;
    this.fusionTicks.push(at);
    this.fusionTicks = this.fusionTicks.filter((x) => at - x < 1000);
  }

  notePowertrain(at = performance.now()) {
    this.timestamps.powertrainAt = at;
  }

  noteAudio(at = performance.now()) {
    this.timestamps.audioAt = at;
    this.audioTicks.push(at);
    this.audioTicks = this.audioTicks.filter((x) => at - x < 1000);
  }

  snapshot(
    now = Date.now(),
    fallbackTier: MotionPipelineMetrics["fallbackTier"] = null,
  ): MotionPipelineMetrics {
    const latencies = computePipelineLatencies(this.timestamps);
    const displayAgeMs = this.lastDisplayAt !== null ? now - this.lastDisplayAt : null;
    const phoneLatencyMs = latencies.endToEndMs ?? latencies.totalPipelineMs;
    return {
      timestamps: { ...this.timestamps },
      latencies,
      phoneSendHz: this.phoneSends.length,
      fusionHz: this.fusionTicks.length,
      audioHz: this.audioTicks.length,
      networkHealth: resolveNetworkHealth({
        phoneSendHz: this.phoneSends.length,
        endToEndMs: latencies.endToEndMs,
        displayAgeMs,
      }),
      seq: this.seq,
      fallbackTier,
      phoneLatencyMs,
      vehicleLatencyMs: this.lastVehicleLatencyMs,
      vehiclePacketRateHz: this.vehicleSends.length,
      packetLossCount: this.packetLossCount,
      reconnectCount: this.reconnectCount,
    };
  }

  suggestedLatencyCompMs(): number {
    const e2e = computePipelineLatencies(this.timestamps).totalPipelineMs;
    const fallback = computePipelineLatencies(this.timestamps).endToEndMs;
    const basis = e2e ?? fallback;
    if (basis === null || !Number.isFinite(basis)) return 0;
    return Math.min(160, Math.max(0, Math.round(basis * 0.62)));
  }
}
