import type { TeslaFleetTelemetryRecord } from "@/lib/motion/vehicle-telemetry/types";

interface CacheRow {
  record: TeslaFleetTelemetryRecord;
  linkId: string | null;
}

const byVin = new Map<string, CacheRow>();
const byLinkId = new Map<string, TeslaFleetTelemetryRecord>();

export function cacheFleetTelemetryRecord(
  record: TeslaFleetTelemetryRecord,
  linkId?: string | null,
): void {
  if (linkId) byLinkId.set(linkId, record);
  if (record.vin) byVin.set(record.vin, { record, linkId: linkId ?? null });
}

export function readCachedFleetTelemetry(input: {
  linkId?: string | null;
  vin?: string | null;
  maxAgeMs?: number;
}): TeslaFleetTelemetryRecord | null {
  const maxAgeMs = input.maxAgeMs ?? 2500;
  const now = Date.now();

  if (input.linkId) {
    const row = byLinkId.get(input.linkId);
    if (row && now - row.receivedAt <= maxAgeMs) return row;
  }

  if (input.vin) {
    const row = byVin.get(input.vin);
    if (row && now - row.record.receivedAt <= maxAgeMs) return row.record;
  }

  return null;
}

export function resetTelemetryCacheForTests(): void {
  byVin.clear();
  byLinkId.clear();
}
