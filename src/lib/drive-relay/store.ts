import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type {
  CreateDriveRelaySessionResult,
  DriveRelaySessionRecord,
  RelayPeerFlags,
  RelayRole,
} from "./types";
import type { TeslaFleetTelemetryRecord } from "../motion/vehicle-telemetry/types";

const SESSION_TTL_MS = 30 * 60 * 1000;
/** QR / claim token lifetime - short by design. */
const CLAIM_TTL_MS = 3 * 60 * 1000;
const HEARTBEAT_STALE_MS = 45_000;
const CLEANUP_INTERVAL_MS = 60_000;
const CODE_ATTEMPT_WINDOW_MS = 60_000;
const CODE_ATTEMPT_MAX = 12;

const sessions = new Map<string, DriveRelaySessionRecord>();
const claimIndex = new Map<string, string>(); // claimToken → sessionId
const pairingCodeIndex = new Map<string, string>(); // pairingCode → sessionId
const authAttempts = new Map<string, { count: number; windowStart: number }>();

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

function randomClaimToken(): string {
  return randomBytes(24).toString("base64url");
}

function randomPairingCode(): string {
  for (let i = 0; i < 20; i += 1) {
    const code = String(randomInt(100_000, 1_000_000));
    if (!pairingCodeIndex.has(code)) return code;
  }
  return String(randomInt(100_000, 1_000_000));
}

function peerFlags(session: DriveRelaySessionRecord): RelayPeerFlags {
  return {
    display: session.displayConnected,
    phone: session.phoneConnected,
    telemetry: session.telemetryConnected,
  };
}

function registerIndexes(record: DriveRelaySessionRecord) {
  claimIndex.set(record.claimToken, record.id);
  pairingCodeIndex.set(record.pairingCode, record.id);
}

function unregisterIndexes(record: DriveRelaySessionRecord) {
  claimIndex.delete(record.claimToken);
  pairingCodeIndex.delete(record.pairingCode);
}

function allowAuthAttempt(key: string, max = CODE_ATTEMPT_MAX): boolean {
  const now = Date.now();
  const row = authAttempts.get(key);
  if (!row || now - row.windowStart > CODE_ATTEMPT_WINDOW_MS) {
    authAttempts.set(key, { count: 1, windowStart: now });
    return true;
  }
  row.count += 1;
  return row.count <= max;
}

function allowPairingAttempt(actorKey: string, scope: string): boolean {
  // The actor bucket prevents rotating candidate codes from bypassing the limit.
  // The global bucket bounds aggregate abuse when no trustworthy client IP is available.
  return (
    allowAuthAttempt(`actor:${actorKey}`) &&
    allowAuthAttempt(`scope:${scope}:${actorKey}`) &&
    allowAuthAttempt("global:pairing", CODE_ATTEMPT_MAX * 20)
  );
}

function secretMatches(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createDriveRelaySession(): CreateDriveRelaySessionResult {
  ensureCleanup();
  const id = randomSessionId();
  const now = Date.now();
  const claimToken = randomClaimToken();
  const pairingCode = randomPairingCode();
  const record: DriveRelaySessionRecord = {
    id,
    roleSecrets: {
      display: randomJoinSecret(),
      phone: randomJoinSecret(),
      telemetry: randomJoinSecret(),
    },
    pairingCode,
    claimToken,
    claimExpiresAt: now + CLAIM_TTL_MS,
    claimUsedAt: null,
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
  registerIndexes(record);
  return {
    sessionId: id,
    pairingCode: record.pairingCode,
    joinSecret: record.roleSecrets.display,
    claimToken: record.claimToken,
    claimExpiresAt: record.claimExpiresAt,
    expiresAt: record.expiresAt,
    pairPath: `/pair/${encodeURIComponent(claimToken)}`,
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
  actorKey = "anonymous",
): { joinSecret: string; expiresAt: number } | null {
  if (!allowPairingAttempt(actorKey, `join:${sessionId}`)) return null;
  const session = getDriveRelaySession(sessionId);
  if (!session) return null;
  if (session.pairingCode !== pairingCode.trim()) return null;
  if (session.phoneConnected) return null;
  session.lastHeartbeatAt = Date.now();
  return { joinSecret: session.roleSecrets.phone, expiresAt: session.expiresAt };
}

/** Manual code entry without knowing sessionId (phone opens /pair). */
export function joinDriveRelayByPairingCode(
  pairingCode: string,
  actorKey = "anonymous",
): { sessionId: string; joinSecret: string; expiresAt: number } | null {
  const code = pairingCode.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(code)) return null;
  if (!allowPairingAttempt(actorKey, "manual-code")) return null;
  const sessionId = pairingCodeIndex.get(code);
  if (!sessionId) return null;
  const session = getDriveRelaySession(sessionId);
  if (!session || session.pairingCode !== code) return null;
  if (session.phoneConnected) return null;
  session.lastHeartbeatAt = Date.now();
  return {
    sessionId: session.id,
    joinSecret: session.roleSecrets.phone,
    expiresAt: session.expiresAt,
  };
}

/** Consume short-lived QR claim token once → long-lived join secret. */
export function claimDriveRelayToken(
  claimToken: string,
  actorKey = "anonymous",
): { sessionId: string; joinSecret: string; expiresAt: number } | null {
  const token = claimToken.trim();
  if (!token || token.length < 16) return null;
  if (!allowPairingAttempt(actorKey, "claim")) return null;
  const sessionId = claimIndex.get(token);
  if (!sessionId) return null;
  const session = getDriveRelaySession(sessionId);
  if (!session || session.claimToken !== token) return null;
  if (session.claimUsedAt != null) return null;
  if (session.claimExpiresAt <= Date.now()) return null;
  if (session.phoneConnected) return null;
  session.claimUsedAt = Date.now();
  session.lastHeartbeatAt = Date.now();
  return {
    sessionId: session.id,
    joinSecret: session.roleSecrets.phone,
    expiresAt: session.expiresAt,
  };
}

export function peekClaimToken(
  claimToken: string,
): { sessionId: string; expired: boolean; used: boolean; phoneConnected: boolean } | null {
  const sessionId = claimIndex.get(claimToken.trim());
  if (!sessionId) return null;
  const session = getDriveRelaySession(sessionId);
  if (!session || session.claimToken !== claimToken.trim()) return null;
  return {
    sessionId: session.id,
    expired: session.claimExpiresAt <= Date.now(),
    used: session.claimUsedAt != null,
    phoneConnected: session.phoneConnected,
  };
}

export function validateRelayToken(
  sessionId: string,
  role: RelayRole,
  token: string,
): DriveRelaySessionRecord | null {
  const session = getDriveRelaySession(sessionId);
  if (!session || !secretMatches(session.roleSecrets[role], token)) return null;
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
  const current = bucket[role];
  if (current && current.id !== peer.id) {
    return null;
  }

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

export function isRelayPeerAttached(sessionId: string, role: RelayRole, peerId: string): boolean {
  return peersBySession.get(sessionId)?.[role]?.id === peerId;
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
  const record = sessions.get(sessionId);
  if (record) unregisterIndexes(record);
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
  claimIndex.clear();
  pairingCodeIndex.clear();
  authAttempts.clear();
}

export const DRIVE_RELAY_CLAIM_TTL_MS = CLAIM_TTL_MS;
