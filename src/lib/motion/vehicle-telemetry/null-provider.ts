import type { MotionSample } from "@/lib/motion/types";
import type {
  VehicleTelemetryProvider,
  VehicleTelemetryStatusSnapshot,
} from "@/lib/motion/vehicle-telemetry/types";

/** Default no-op provider — used when feature flag is off or kind is none. */
export class NullVehicleTelemetryProvider implements VehicleTelemetryProvider {
  readonly id = "none";
  readonly label = "None";

  getStatus(): VehicleTelemetryStatusSnapshot {
    return {
      id: this.id,
      label: this.label,
      status: "disabled",
      lastSampleAt: null,
    };
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  subscribe(_listener: (sample: MotionSample) => void): () => void {
    return () => {};
  }
}
