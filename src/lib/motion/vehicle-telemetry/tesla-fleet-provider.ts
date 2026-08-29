import type { MotionSample } from "@/lib/motion/types";
import { mapTeslaFleetSignalsToMotionSample } from "@/lib/motion/vehicle-telemetry/map-tesla-signals";
import type {
  TeslaFleetTelemetryRecord,
  VehicleTelemetryProvider,
  VehicleTelemetryStatus,
  VehicleTelemetryStatusSnapshot,
} from "@/lib/motion/vehicle-telemetry/types";

type Listener = (sample: MotionSample) => void;

/**
 * Tesla Fleet Telemetry adapter.
 *
 * ELCAMOSO does not connect to Tesla from the in-car browser directly.
 * A server-side Fleet Telemetry receiver forwards decoded records here
 * (future: drive-relay `telemetry` role or ELCAMOSO Cloud bridge).
 *
 * This class never fabricates field values — it only maps records that arrive
 * via ingest().
 */
export class TeslaFleetTelemetryProvider implements VehicleTelemetryProvider {
  readonly id = "tesla-fleet";
  readonly label = "Tesla Fleet Telemetry";

  private status: VehicleTelemetryStatus = "idle";
  private detail: string | undefined;
  private lastSampleAt: number | null = null;
  private listeners = new Set<Listener>();
  private connected = false;

  getStatus(): VehicleTelemetryStatusSnapshot {
    return {
      id: this.id,
      label: this.label,
      status: this.status,
      ...(this.detail ? { detail: this.detail } : {}),
      lastSampleAt: this.lastSampleAt,
    };
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.status = "idle";
    this.detail = "Awaiting Fleet Telemetry records from server bridge";
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.status = "idle";
    this.detail = undefined;
    this.lastSampleAt = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ingress from server bridge — the only path that produces samples. */
  ingest(record: TeslaFleetTelemetryRecord): boolean {
    if (!this.connected) return false;
    const sample = mapTeslaFleetSignalsToMotionSample(record);
    if (!sample) return false;

    this.lastSampleAt = record.receivedAt;
    this.status = "connected";
    this.detail = undefined;
    for (const listener of this.listeners) listener(sample);
    return true;
  }
}
