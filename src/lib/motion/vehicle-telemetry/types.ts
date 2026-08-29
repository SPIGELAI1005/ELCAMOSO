import type { MotionSample } from "@/lib/motion/types";

/** Provider lifecycle — Dynamic Drive must run without any of these. */
export type VehicleTelemetryStatus = "disabled" | "idle" | "connecting" | "connected" | "error";

export interface VehicleTelemetryStatusSnapshot {
  id: string;
  label: string;
  status: VehicleTelemetryStatus;
  detail?: string;
  lastSampleAt: number | null;
}

/**
 * Pluggable vehicle telemetry ingress.
 *
 * Dynamic Drive uses this interface so OEM telemetry (Tesla Fleet Telemetry today)
 * is optional and isolated behind `settings.teslaFleetTelemetry`.
 * Implementations must emit MotionSample values only from real decoded records.
 *
 * @see docs/dynamic-drive/tesla-telemetry.md
 */
export interface VehicleTelemetryProvider {
  readonly id: string;
  readonly label: string;
  getStatus(): VehicleTelemetryStatusSnapshot;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(listener: (sample: MotionSample) => void): () => void;
}

/** Known Tesla Fleet Telemetry signal names (subset used for motion mapping). */
export type TeslaFleetMotionField =
  | "VehicleSpeed"
  | "LongitudinalAcceleration"
  | "LateralAcceleration"
  | "GpsHeading"
  | "PedalPosition"
  | "DiAxleSpeedR"
  | "DiAxleSpeedF"
  | "DiAxleSpeedREL"
  | "DiAxleSpeedRER"
  | "Gear"
  | "DriveRail";

/**
 * Normalized record from a Fleet Telemetry server bridge.
 * Values must come from Tesla protobuf payloads — never synthesized client-side.
 */
export interface TeslaFleetTelemetryRecord {
  /** Epoch ms when the server received or decoded the payload. */
  receivedAt: number;
  /** Optional vehicle identifier for multi-car fleets. */
  vin?: string;
  /** Raw field bag keyed by Tesla Fleet Telemetry field name. */
  fields: Partial<Record<string, unknown>>;
}

export interface CreateVehicleTelemetryProviderOptions {
  enabled: boolean;
  kind: "none" | "tesla-fleet";
}
