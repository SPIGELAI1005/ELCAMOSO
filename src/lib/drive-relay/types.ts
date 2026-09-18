import type { RelayMotionMessage } from "../motion/relay-sample";
import type { RelayTelemetryMessage } from "../motion/relay-telemetry";
export type RelayRole = "display" | "phone" | "telemetry";

export type RelayConnectionState =
  "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "expired" | "error";

export interface RelayPeerFlags {
  display: boolean;
  phone: boolean;
  telemetry: boolean;
}

export interface DriveRelaySessionRecord {
  id: string;
  /** Role-bound credentials. Never return the complete set to a client. */
  roleSecrets: Record<RelayRole, string>;
  pairingCode: string;
  /** Opaque one-time QR claim token (not the long-lived join secret). */
  claimToken: string;
  claimExpiresAt: number;
  claimUsedAt: number | null;
  createdAt: number;
  expiresAt: number;
  lastHeartbeatAt: number;
  displayConnected: boolean;
  phoneConnected: boolean;
  telemetryConnected: boolean;
  displayPeerId: string | null;
  phonePeerId: string | null;
  telemetryPeerId: string | null;
}

export interface CreateDriveRelaySessionResult {
  sessionId: string;
  pairingCode: string;
  /** Display-side WebSocket credential (Tesla). */
  joinSecret: string;
  /** Short-lived QR / claim URL token - single-use for phone claim. */
  claimToken: string;
  claimExpiresAt: number;
  expiresAt: number;
  /** Path for QR: `/pair/{claimToken}` */
  pairPath: string;
  /** @deprecated Prefer pairPath - kept for older clients. */
  connectPath: string;
}

export type RelayMessage =
  | { type: "heartbeat"; at: number }
  | { type: "status"; peers: RelayPeerFlags; at: number }
  | { type: "action"; id: string; from: RelayRole; kind: string; at: number; payload?: unknown }
  | { type: "latency-ping"; id: string; from: RelayRole; sentAt: number }
  | { type: "latency-pong"; id: string; from: RelayRole; sentAt: number; receivedAt: number }
  | { type: "error"; code: string; message: string }
  | {
      type: "entitlement-update";
      plan: "DRIVE_PLUS" | "FREE";
      revision: number;
      at: number;
      upgradeToken?: string;
    }
  | RelayMotionMessage
  | RelayTelemetryMessage;

export interface RelayUpgradeContext {
  sessionId: string;
  role: RelayRole;
  /** The credential has already been verified for `role`. */
  credential: string;
}
