export type {
  CreateVehicleTelemetryProviderOptions,
  TeslaFleetTelemetryRecord,
  VehicleTelemetryProvider,
  VehicleTelemetryStatus,
  VehicleTelemetryStatusSnapshot,
} from "@/lib/motion/vehicle-telemetry/types";
export {
  createVehicleTelemetryProvider,
  getTeslaFleetTelemetryProvider,
  resetVehicleTelemetryProvidersForTests,
} from "@/lib/motion/vehicle-telemetry/create-provider";
export { mapTeslaFleetSignalsToMotionSample } from "@/lib/motion/vehicle-telemetry/map-tesla-signals";
export { NullVehicleTelemetryProvider } from "@/lib/motion/vehicle-telemetry/null-provider";
export { TeslaFleetTelemetryProvider } from "@/lib/motion/vehicle-telemetry/tesla-fleet-provider";
