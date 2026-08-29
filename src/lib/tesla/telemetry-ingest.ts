import { createServerFn } from "@tanstack/react-start";
import { pushTelemetryToDisplay } from "@/lib/drive-relay/store";
import type { TeslaFleetTelemetryRecord } from "@/lib/motion/vehicle-telemetry/types";
import { ingestFleetTelemetryRecord } from "@/lib/tesla/telemetry-bridge";

let telemetrySeq = 0;

export interface FleetTelemetryIngestInput {
  sessionId: string;
  linkId?: string | undefined;
  vin?: string | undefined;
  fields: Record<string, unknown>;
  receivedAt?: number | undefined;
}

/** Server bridge: forward decoded Fleet Telemetry fields to an active Drive relay session. */
export const ingestFleetTelemetryFn = createServerFn({ method: "POST" })
  .inputValidator((data: FleetTelemetryIngestInput) => data)
  .handler(({ data }) => {
    if (!data.sessionId || !data.fields || typeof data.fields !== "object") {
      return { ok: false as const, message: "Invalid ingest payload." };
    }
    telemetrySeq += 1;
    const record: TeslaFleetTelemetryRecord = {
      receivedAt: data.receivedAt ?? Date.now(),
      ...(data.vin ? { vin: data.vin } : {}),
      fields: data.fields,
    };
    ingestFleetTelemetryRecord(record, data.linkId ?? null);
    const delivered = pushTelemetryToDisplay(data.sessionId, record, telemetrySeq);
    if (!delivered) {
      return {
        ok: false as const,
        message: "No active Drive session display connected for this session id.",
      };
    }
    return { ok: true as const, seq: telemetrySeq };
  });

export function resetFleetTelemetrySeqForTests() {
  telemetrySeq = 0;
}
