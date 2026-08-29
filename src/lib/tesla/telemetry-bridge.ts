import { fetchVehicleDataFields } from "@/lib/tesla/fleet-api";
import { getLinkRecord } from "@/lib/tesla/link-store";
import { cacheFleetTelemetryRecord, readCachedFleetTelemetry } from "@/lib/tesla/telemetry-cache";
import type { TeslaFleetTelemetryRecord } from "@/lib/motion/vehicle-telemetry/types";

const POLL_MIN_INTERVAL_MS = 2000;
const lastPollAtByLink = new Map<string, number>();

function readEnvFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "off") return false;
  return true;
}

/** Read-only vehicle_data poll when Fleet Telemetry stream is unavailable (dev / fallback). */
export function vehicleDataPollEnabled(): boolean {
  return readEnvFlag("TESLA_VEHICLE_DATA_POLL", true);
}

export function ingestFleetTelemetryRecord(
  record: TeslaFleetTelemetryRecord,
  linkId?: string | null,
): void {
  cacheFleetTelemetryRecord(record, linkId ?? null);
}

export async function pullVehicleTelemetryRecord(input: {
  linkId: string;
  vin?: string | null;
}): Promise<TeslaFleetTelemetryRecord | null> {
  const link = getLinkRecord(input.linkId);
  if (!link) return null;

  const vin = input.vin ?? link.selectedVin ?? link.vehicles[0]?.vin ?? null;

  const streamed = readCachedFleetTelemetry({
    linkId: input.linkId,
    vin,
    maxAgeMs: 2500,
  });
  if (streamed) return streamed;

  if (!vehicleDataPollEnabled() || !vin) return null;

  const now = Date.now();
  const lastPoll = lastPollAtByLink.get(input.linkId) ?? 0;
  if (now - lastPoll < POLL_MIN_INTERVAL_MS) {
    return readCachedFleetTelemetry({ linkId: input.linkId, vin, maxAgeMs: 6000 });
  }

  lastPollAtByLink.set(input.linkId, now);
  const polled = await fetchVehicleDataFields(input.linkId, vin);
  if (!polled) {
    return readCachedFleetTelemetry({ linkId: input.linkId, vin, maxAgeMs: 6000 });
  }

  cacheFleetTelemetryRecord(polled, input.linkId);
  return polled;
}

export function resetTelemetryBridgeForTests(): void {
  lastPollAtByLink.clear();
}
