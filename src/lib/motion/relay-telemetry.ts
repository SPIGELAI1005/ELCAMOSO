import type { TeslaFleetTelemetryRecord } from "@/lib/motion/vehicle-telemetry/types";

/** Fleet Telemetry record relayed from server bridge to the in-car display. */
export interface RelayTelemetryMessage {
  type: "telemetry";
  from: "telemetry";
  at: number;
  seq: number;
  record: TeslaFleetTelemetryRecord;
  /** Wall clock when the relay server forwarded to display (optional). */
  serverAt?: number;
}

export function isRelayTelemetryMessage(raw: unknown): raw is RelayTelemetryMessage {
  if (!raw || typeof raw !== "object") return false;
  const m = raw as Record<string, unknown>;
  if (m["type"] !== "telemetry" || m["from"] !== "telemetry") return false;
  if (typeof m["at"] !== "number" || typeof m["seq"] !== "number") return false;
  const record = m["record"];
  if (!record || typeof record !== "object") return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r["receivedAt"] === "number" && r["fields"] !== null && typeof r["fields"] === "object"
  );
}
