import {
  attachRelayPeer,
  detachRelayPeer,
  isRelayPeerAttached,
  relayToPeer,
  touchDriveRelaySession,
  validateRelayToken,
} from "./store";
import { parseRelayMessage, parseRelayRole } from "./protocol";
import { RELAY_MAX_MESSAGE_BYTES } from "./config";
import type { RelayRole, RelayUpgradeContext } from "./types";

const motionRateByPeer = new Map<string, { windowStart: number; count: number }>();
const telemetryRateByPeer = new Map<string, { windowStart: number; count: number }>();
const MOTION_RATE_MAX = 22;
const TELEMETRY_RATE_MAX = 12;

function allowMotionRelay(peerId: string): boolean {
  const now = Date.now();
  const bucket = motionRateByPeer.get(peerId) ?? { windowStart: now, count: 0 };
  if (now - bucket.windowStart > 1000) {
    bucket.windowStart = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  motionRateByPeer.set(peerId, bucket);
  return bucket.count <= MOTION_RATE_MAX;
}

function allowTelemetryRelay(peerId: string): boolean {
  const now = Date.now();
  const bucket = telemetryRateByPeer.get(peerId) ?? { windowStart: now, count: 0 };
  if (now - bucket.windowStart > 1000) {
    bucket.windowStart = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  telemetryRateByPeer.set(peerId, bucket);
  return bucket.count <= TELEMETRY_RATE_MAX;
}

export interface RelayPeerLike {
  id: string;
  context: RelayUpgradeContext;
  send: (data: unknown) => void;
  close?: (code?: number, reason?: string) => void;
}

export function validateRelayUpgrade(params: {
  sessionId: string | null;
  role: string | null;
  token: string | null;
}): RelayUpgradeContext {
  const role = parseRelayRole(params.role);
  if (!params.sessionId || !role || !params.token) {
    throw new Response("Missing session parameters", { status: 400 });
  }
  const session = validateRelayToken(params.sessionId, role, params.token);
  if (!session) {
    throw new Response("Invalid or expired session", { status: 401 });
  }
  return {
    sessionId: session.id,
    role,
    credential: params.token,
  };
}

export function onRelayOpen(peer: RelayPeerLike): boolean {
  const attached = attachRelayPeer(peer.context.sessionId, peer.context.role, {
    id: peer.id,
    send: (data) => peer.send(data),
  });
  if (!attached) {
    peer.send({ type: "error", code: "role-already-connected", message: "Role already connected" });
    peer.close?.(4409, "role-already-connected");
    return false;
  }
  return true;
}

export function onRelayClose(peer: RelayPeerLike) {
  motionRateByPeer.delete(peer.id);
  telemetryRateByPeer.delete(peer.id);
  detachRelayPeer(peer.context.sessionId, peer.context.role, peer.id);
}

export function onRelayMessage(peer: RelayPeerLike, raw: unknown) {
  if (typeof raw === "string" && raw.length > RELAY_MAX_MESSAGE_BYTES) {
    peer.send({ type: "error", code: "message-too-large", message: "Payload exceeds limit" });
    return;
  }
  if (raw && typeof raw === "object") {
    try {
      if (JSON.stringify(raw).length > RELAY_MAX_MESSAGE_BYTES) {
        peer.send({ type: "error", code: "message-too-large", message: "Payload exceeds limit" });
        return;
      }
    } catch {
      peer.send({ type: "error", code: "bad-message", message: "Unrecognized message" });
      return;
    }
  }

  const message = parseRelayMessage(raw);
  if (!message) {
    peer.send({ type: "error", code: "bad-message", message: "Unrecognized message" });
    return;
  }

  if (!isRelayPeerAttached(peer.context.sessionId, peer.context.role, peer.id)) {
    peer.send({ type: "error", code: "peer-not-attached", message: "Relay peer is not active" });
    peer.close?.(4401, "peer-not-attached");
    return;
  }

  const { sessionId, role } = peer.context;

  if (message.type === "heartbeat") {
    touchDriveRelaySession(sessionId);
    return;
  }

  if (message.type === "latency-ping") {
    if (message.from !== role) return;
    relayToPeer(sessionId, role, message);
    return;
  }

  if (message.type === "latency-pong") {
    if (message.from !== role) return;
    relayToPeer(sessionId, role, message);
    return;
  }

  if (message.type === "action") {
    if (message.from !== role) return;
    relayToPeer(sessionId, role, message);
    return;
  }

  if (message.type === "motion") {
    if (role !== "phone" || message.from !== "phone") return;
    if (!allowMotionRelay(peer.id)) return;
    relayToPeer(sessionId, "phone", { ...message, serverAt: Date.now() });
    return;
  }

  if (message.type === "telemetry") {
    if (role !== "telemetry" || message.from !== "telemetry") return;
    if (!allowTelemetryRelay(peer.id)) return;
    relayToPeer(sessionId, "telemetry", { ...message, serverAt: Date.now() });
  }
}
