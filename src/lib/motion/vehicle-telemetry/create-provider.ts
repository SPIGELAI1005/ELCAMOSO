import { NullVehicleTelemetryProvider } from "@/lib/motion/vehicle-telemetry/null-provider";
import { TeslaFleetTelemetryProvider } from "@/lib/motion/vehicle-telemetry/tesla-fleet-provider";
import type {
  CreateVehicleTelemetryProviderOptions,
  VehicleTelemetryProvider,
} from "@/lib/motion/vehicle-telemetry/types";

let teslaFleetSingleton: TeslaFleetTelemetryProvider | null = null;

export function createVehicleTelemetryProvider(
  options: CreateVehicleTelemetryProviderOptions,
): VehicleTelemetryProvider {
  if (!options.enabled || options.kind === "none") {
    return new NullVehicleTelemetryProvider();
  }

  if (options.kind === "tesla-fleet") {
    if (!teslaFleetSingleton) teslaFleetSingleton = new TeslaFleetTelemetryProvider();
    return teslaFleetSingleton;
  }

  return new NullVehicleTelemetryProvider();
}

/** Resolve the active Tesla adapter for server-side / relay ingest. */
export function getTeslaFleetTelemetryProvider(): TeslaFleetTelemetryProvider | null {
  return teslaFleetSingleton;
}

export function resetVehicleTelemetryProvidersForTests(): void {
  teslaFleetSingleton = null;
}
