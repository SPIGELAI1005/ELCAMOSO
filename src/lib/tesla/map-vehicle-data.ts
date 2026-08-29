import type { TeslaFleetTelemetryRecord } from "@/lib/motion/vehicle-telemetry/types";

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Map Fleet API `vehicle_data` (read-only poll) into Fleet Telemetry field names
 * so the same MotionSample mapper applies. Only copies fields present in the response.
 *
 * @see https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints
 */
export function mapVehicleDataToTelemetryRecord(input: {
  vin: string;
  response: unknown;
  receivedAt?: number;
}): TeslaFleetTelemetryRecord | null {
  if (!input.response || typeof input.response !== "object") return null;
  const root = input.response as Record<string, unknown>;
  const body = root["response"];
  if (!body || typeof body !== "object") return null;

  const driveState = (body as Record<string, unknown>)["drive_state"];
  if (!driveState || typeof driveState !== "object") return null;

  const ds = driveState as Record<string, unknown>;
  const fields: Record<string, unknown> = {};

  const speedMph = num(ds["speed"]);
  if (speedMph !== null && speedMph >= 0) fields["VehicleSpeed"] = speedMph;

  const shift = str(ds["shift_state"]);
  if (shift) fields["Gear"] = shift.toUpperCase();

  const pedal = num(ds["pedal_position"]);
  if (pedal !== null) fields["PedalPosition"] = pedal;

  const powerKw = num(ds["power"]);
  if (powerKw !== null && powerKw > 0) fields["DriveRail"] = true;
  else if (powerKw === 0) fields["DriveRail"] = false;

  if (Object.keys(fields).length === 0) return null;

  const tsSec = num(ds["timestamp"]);
  const receivedAt =
    input.receivedAt ??
    (tsSec !== null && tsSec > 1_000_000_000 ? Math.round(tsSec * 1000) : Date.now());

  return { receivedAt, vin: input.vin, fields };
}
