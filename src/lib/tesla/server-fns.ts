import { createServerFn } from "@tanstack/react-start";

import type { TeslaOAuthCallbackInput } from "@/lib/tesla/types";

export interface PullVehicleTelemetryResponse {
  ok: boolean;
  record: {
    receivedAt: number;
    vin?: string;
    fields: Record<string, string | number | boolean | null>;
  } | null;
}

function serializeTelemetryRecord(
  record: NonNullable<
    Awaited<
      ReturnType<
        typeof import("@/lib/tesla/telemetry-bridge").pullVehicleTelemetryRecord
      >
    >
  >,
): PullVehicleTelemetryResponse["record"] {
  const fields: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(record.fields)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      fields[key] = value;
    }
  }
  return {
    receivedAt: record.receivedAt,
    ...(record.vin !== undefined ? { vin: record.vin } : {}),
    fields,
  };
}

export const getTeslaConnectionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { linkId?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getTeslaConnectionStatus } = await import("@/lib/tesla/service");
    return getTeslaConnectionStatus(data.linkId ?? null);
  });

export const startTeslaOAuthFn = createServerFn({ method: "POST" })
  .inputValidator((data: { linkId: string; consentAccepted: boolean }) => data)
  .handler(async ({ data }) => {
    const { startTeslaOAuth } = await import("@/lib/tesla/service");
    return startTeslaOAuth(data);
  });

export const disconnectTeslaFn = createServerFn({ method: "POST" })
  .inputValidator((data: { linkId: string }) => data)
  .handler(async ({ data }) => {
    const { disconnectTesla } = await import("@/lib/tesla/service");
    return disconnectTesla(data.linkId);
  });

export const selectTeslaVehicleFn = createServerFn({ method: "POST" })
  .inputValidator((data: { linkId: string; vin: string }) => data)
  .handler(async ({ data }) => {
    const { selectTeslaVehicle } = await import("@/lib/tesla/service");
    return selectTeslaVehicle(data.linkId, data.vin);
  });

export const refreshTeslaVehiclesFn = createServerFn({ method: "POST" })
  .inputValidator((data: { linkId: string }) => data)
  .handler(async ({ data }) => {
    const { syncTeslaVehicles } = await import("@/lib/tesla/service");
    return syncTeslaVehicles(data.linkId);
  });

/** Pull latest vehicle motion (Fleet Telemetry cache or read-only vehicle_data poll). */
export const pullVehicleTelemetryFn = createServerFn({ method: "POST" })
  .inputValidator((data: { linkId: string; vin?: string | null }) => data)
  .handler(async ({ data }): Promise<PullVehicleTelemetryResponse> => {
    const { pullVehicleTelemetryRecord } = await import("@/lib/tesla/telemetry-bridge");
    const record = await pullVehicleTelemetryRecord({
      linkId: data.linkId,
      vin: data.vin ?? null,
    });
    return { ok: Boolean(record), record: record ? serializeTelemetryRecord(record) : null };
  });

/** Server-only OAuth callback handler (also used by GET route loader). */
export const teslaOAuthCallbackFn = createServerFn({ method: "POST" })
  .inputValidator((data: TeslaOAuthCallbackInput) => data)
  .handler(async ({ data }) => {
    const { handleTeslaOAuthCallback } = await import("@/lib/tesla/service");
    return handleTeslaOAuthCallback(data);
  });
