import { randomBytes, randomInt } from "node:crypto";
import type {
  CreateDriveRelaySessionResult,
  DriveRelaySessionRecord,
  RelayPeerFlags,
  RelayRole,
} from "./types";
import type { TeslaFleetTelemetryRecord } from "../motion/vehicle-telemetry/types";

const SESSION_TTL_MS = 30 * 60 * 1000;
const HEARTBEAT_STALE_MS = 45_000;
const CLEANUP_INTERVAL_MS = 60_000;

const sessions = new Map<string, DriveRelaySessionRecord>();

type PeerSender = { id: string; send: (data: unknown) => void };

const peersBySession = new Map<
  string,
  { display?: PeerSender; phone?: PeerSender; telemetry?: PeerSender }
>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => purgeStaleSessions(), CLEANUP_INTERVAL_MS);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

function randomSessionId(): string {
  return randomBytes(9).toString("base64url");
}

function randomJoinSecret(): string {
  return randomBytes(18).toString("base64url");
}

function randomPairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function peerFlags(session: DriveRelaySessionRecord): RelayPeerFlags {
  return {
    display: session.displayConnected,
    phone: session.phoneConnected,
    telemetry: session.telemetryConnected,
  };
}

export function createDriveRelaySession(): CreateDriveRelaySessionResult {
  ensureCleanup();
  const id = randomSessionId();
  const now = Date.now();
  const record: DriveRelaySessionRecord = {
    id,
    joinSecret: randomJoinSecret(),
    pairingCode: randomPairingCode(),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    lastHeartbeatAt: now,
    displayConnected: false,
    phoneConnected: false,
    telemetryConnected: false,
    displayPeerId: null,
    phonePeerId: null,
    telemetryPeerId: null,
  };
  sessions.set(id, record);
  peersBySession.set(id, {});
  return {
    sessionId: id,
    pairingCode: record.pairingCode,
    joinSecret: record.joinSecret,
    expiresAt: record.expiresAt,
    connectPath: `/connect/${id}`,
  };
}

export function getDriveRelaySession(sessionId: string): DriveRelaySessionRecord | null {
  purgeStaleSessions();
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    deleteDriveRelaySession(sessionId);
    return null;
  }
  return session;
}

export function joinDriveRelaySession(
  sessionId: string,
  pairingCode: string,
): { joinSecret: string; expiresAt: number } | null {
  const session = getDriveRelaySession(sessionId);
  if (!session) return null;
  if (session.pairingCode !== pairingCode.trim()) return null;
  session.lastHeartbeatAt = Date.now();
  return { joinSecret: session.joinSecret, expiresAt: session.expiresAt };
}

export function validateRelayToken(
  sessionId: string,
  token: string,
): DriveRelaySessionRecord | null {
  const session = getDriveRelaySession(sessionId);
  if (!session || session.joinSecret !== token) return null;
  return session;
}

export function touchDriveRelaySession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.lastHeartbeatAt = Date.now();
  if (session.expiresAt - Date.now() < SESSION_TTL_MS / 2) {
    session.expiresAt = Date.now() + SESSION_TTL_MS;
  }
}

export function attachRelayPeer(
  sessionId: string,
  role: RelayRole,
  peer: PeerSender,
): DriveRelaySessionRecord | null {
  const session = getDriveRelaySession(sessionId);
  if (!session) return null;

  const bucket = peersBySession.get(sessionId) ?? {};
  bucket[role] = peer;
  peersBySession.set(sessionId, bucket);

  if (role === "display") {
    session.displayConnected = true;
    session.displayPeerId = peer.id;
  } else if (role === "phone") {
    session.phoneConnected = true;
    session.phonePeerId = peer.id;
  } else {
    session.telemetryConnected = true;
    session.telemetryPeerId = peer.id;
  }
  touchDriveRelaySession(sessionId);
  broadcastStatus(session);
  return session;
}

export function detachRelayPeer(sessionId: string, role: RelayRole, peerId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const bucket = peersBySession.get(sessionId);
  const current = bucket?.[role];
  if (current?.id !== peerId) return;

  delete bucket?.[role];

  if (role === "display") {
    session.displayConnected = false;
    session.displayPeerId = null;
  } else if (role === "phone") {
    session.phoneConnected = false;
    session.phonePeerId = null;
  } else {
    session.telemetryConnected = false;
    session.telemetryPeerId = null;
  }
  broadcastStatus(session);
}

export function relayToPeer(sessionId: string, from: RelayRole, message: unknown) {
  const bucket = peersBySession.get(sessionId);
  if (!bucket) return;

  const targets: RelayRole[] =
    from === "display"
      ? ["phone", "telemetry"]
      : from === "phone"
        ? ["display", "telemetry"]
        : from === "telemetry"
          ? ["display"]
          : ["display", "phone"];

  for (const role of targets) {
    bucket[role]?.send(message);
  }
}

/** Push a Fleet Telemetry record to the in-car display peer (server bridge). */
export function pushTelemetryToDisplay(
  sessionId: string,
  record: TeslaFleetTelemetryRecord,
  seq: number,
): boolean {
  const bucket = peersBySession.get(sessionId);
  const display = bucket?.display;
  if (!display) return false;
  display.send({
    type: "telemetry",
    from: "telemetry",
    at: Date.now(),
    seq,
    record,
    serverAt: Date.now(),
  });
  return true;
}

export function pushEntitlementUpdateToDisplay(
  sessionId: string,
  payload: { plan: "DRIVE_PLUS" | "FREE"; revision: number; upgradeToken?: string },
): boolean {
  const bucket = peersBySession.get(sessionId);
  const display = bucket?.display;
  if (!display) return false;
  display.send({
    type: "entitlement-update",
    plan: payload.plan,
    revision: payload.revision,
    at: Date.now(),
    ...(payload.upgradeToken ? { upgradeToken: payload.upgradeToken } : {}),
  });
  return true;
}

export function broadcastStatus(session: DriveRelaySessionRecord) {
  const bucket = peersBySession.get(session.id);
  if (!bucket) return;
  const payload = {
    type: "status" as const,
    at: Date.now(),
    peers: peerFlags(session),
  };
  for (const peer of Object.values(bucket)) {
    peer?.send(payload);
  }
}

export function deleteDriveRelaySession(sessionId: string) {
  sessions.delete(sessionId);
  peersBySession.delete(sessionId);
}

export function purgeStaleSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    const expired = session.expiresAt <= now;
    const heartbeatStale = now - session.lastHeartbeatAt > HEARTBEAT_STALE_MS;
    if (expired || (heartbeatStale && !session.displayConnected && !session.phoneConnected)) {
      deleteDriveRelaySession(id);
    }
  }
}

/** Test-only reset */
export function resetDriveRelayStoreForTests() {
  sessions.clear();
  peersBySession.clear();
}
