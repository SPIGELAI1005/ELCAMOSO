import type { RelayMessage, RelayRole } from "./types";
import type { RelayMotionPayload } from "../motion/relay-sample";
import { isRelayTelemetryMessage } from "../motion/relay-telemetry";
import { resolveDriveRelayWsOrigin } from "./config";
const ROLES = new Set<RelayRole>(["display", "phone", "telemetry"]);

export function parseRelayRole(raw: string | null): RelayRole | null {
  if (!raw || !ROLES.has(raw as RelayRole)) return null;
  return raw as RelayRole;
}

export function parseRelayMessage(raw: unknown): RelayMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const type = m["type"];
  if (type === "heartbeat" && typeof m["at"] === "number") {
    return { type: "heartbeat", at: m["at"] };
  }
  if (
    type === "status" &&
    typeof m["at"] === "number" &&
    m["peers"] &&
    typeof m["peers"] === "object"
  ) {
    const peers = m["peers"] as Record<string, unknown>;
    return {
      type: "status",
      at: m["at"],
      peers: {
        display: peers["display"] === true,
        phone: peers["phone"] === true,
        telemetry: peers["telemetry"] === true,
      },
    };
  }
  if (
    type === "action" &&
    typeof m["id"] === "string" &&
    typeof m["kind"] === "string" &&
    typeof m["at"] === "number" &&
    parseRelayRole(String(m["from"]))
  ) {
    return {
      type: "action",
      id: m["id"],
      from: m["from"] as RelayRole,
      kind: m["kind"],
      at: m["at"],
      ...(m["payload"] !== undefined ? { payload: m["payload"] } : {}),
    };
  }
  if (
    type === "latency-ping" &&
    typeof m["id"] === "string" &&
    typeof m["sentAt"] === "number" &&
    parseRelayRole(String(m["from"]))
  ) {
    return {
      type: "latency-ping",
      id: m["id"],
      from: m["from"] as RelayRole,
      sentAt: m["sentAt"],
    };
  }
  if (
    type === "latency-pong" &&
    typeof m["id"] === "string" &&
    typeof m["sentAt"] === "number" &&
    typeof m["receivedAt"] === "number" &&
    parseRelayRole(String(m["from"]))
  ) {
    return {
      type: "latency-pong",
      id: m["id"],
      from: m["from"] as RelayRole,
      sentAt: m["sentAt"],
      receivedAt: m["receivedAt"],
    };
  }
  if (type === "error" && typeof m["code"] === "string" && typeof m["message"] === "string") {
    return { type: "error", code: m["code"], message: m["message"] };
  }
  if (
    type === "motion" &&
    m["from"] === "phone" &&
    typeof m["at"] === "number" &&
    typeof m["seq"] === "number" &&
    m["sample"] &&
    typeof m["sample"] === "object"
  ) {
    const sample = m["sample"] as Record<string, unknown>;
    if (typeof sample["timestamp"] !== "number" || sample["source"] !== "phone") return null;
    return {
      type: "motion",
      from: "phone",
      at: m["at"],
      seq: m["seq"],
      sample: sample as RelayMotionPayload,
      ...(typeof m["serverAt"] === "number" ? { serverAt: m["serverAt"] } : {}),
    };
  }
  if (isRelayTelemetryMessage(m)) {
    return m;
  }
  if (
    type === "entitlement-update" &&
    (m["plan"] === "DRIVE_PLUS" || m["plan"] === "FREE") &&
    typeof m["revision"] === "number"
  ) {
    return {
      type: "entitlement-update",
      plan: m["plan"],
      revision: m["revision"],
      at: typeof m["at"] === "number" ? m["at"] : Date.now(),
      ...(typeof m["upgradeToken"] === "string" ? { upgradeToken: m["upgradeToken"] } : {}),
    };
  }
  return null;
}

export function relayWsPath(): string {
  return "/api/drive-relay/ws";
}

/**
 * Build the WebSocket URL for a relay peer.
 * @param pageOrigin - typically `window.location.origin` (fallback when no dedicated host)
 */
export function buildRelayWsUrl(
  pageOrigin: string,
  sessionId: string,
  role: RelayRole,
  token: string,
): string {
  const origin = resolveDriveRelayWsOrigin(pageOrigin);
  const url = new URL(relayWsPath(), origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("role", role);
  url.searchParams.set("token", token);
  return url.toString();
}

export function connectPagePath(sessionId: string): string {
  return `/connect/${encodeURIComponent(sessionId)}`;
}

export function pairPagePath(claimToken?: string): string {
  if (!claimToken) return "/pair";
  return `/pair/${encodeURIComponent(claimToken)}`;
}

/** Display pairing code as `482 193`. */
export function formatPairingCode(code: string): string {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}
