import { randomUUID } from "node:crypto";

import {
  DYNAMIC_DRIVE_SESSION_END_GRACE_MS,
  DYNAMIC_DRIVE_SESSION_STALE_MS,
} from "@/lib/dynamic-drive-session/config";
import type { DynamicDriveAccountSessionRecord } from "@/lib/dynamic-drive-session/types";

const sessionsByUser = new Map<string, DynamicDriveAccountSessionRecord>();
const sessionsByDriveId = new Map<string, DynamicDriveAccountSessionRecord>();

function indexSession(record: DynamicDriveAccountSessionRecord) {
  sessionsByUser.set(record.userId, record);
  sessionsByDriveId.set(record.driveSessionId, record);
}

function removeSession(record: DynamicDriveAccountSessionRecord) {
  const current = sessionsByUser.get(record.userId);
  if (current?.id === record.id) {
    sessionsByUser.delete(record.userId);
  }
  sessionsByDriveId.delete(record.driveSessionId);
}

export function isDynamicDriveSessionStale(
  session: DynamicDriveAccountSessionRecord,
  now: number,
): boolean {
  return now - session.lastHeartbeatAt > DYNAMIC_DRIVE_SESSION_STALE_MS;
}

export function getActiveDynamicDriveSessionForUser(
  userId: string,
): DynamicDriveAccountSessionRecord | null {
  const session = sessionsByUser.get(userId);
  if (!session || session.status !== "active") return null;
  return session;
}

export function getDynamicDriveSessionByDriveSessionId(
  driveSessionId: string,
): DynamicDriveAccountSessionRecord | null {
  const session = sessionsByDriveId.get(driveSessionId);
  if (!session || session.status !== "active") return null;
  return session;
}

export function purgeStaleDynamicDriveSessions(now = Date.now()): number {
  let purged = 0;
  for (const session of [...sessionsByUser.values()]) {
    if (session.status !== "active") continue;
    if (!isDynamicDriveSessionStale(session, now)) continue;
    const ended: DynamicDriveAccountSessionRecord = {
      ...session,
      status: "ended",
      endedAt: now,
    };
    removeSession(session);
    sessionsByDriveId.set(session.driveSessionId, ended);
    purged += 1;
  }
  return purged;
}

export function endDynamicDriveSession(
  session: DynamicDriveAccountSessionRecord,
  now: number,
): DynamicDriveAccountSessionRecord {
  const ended: DynamicDriveAccountSessionRecord = {
    ...session,
    status: "ended",
    endedAt: now,
    lastHeartbeatAt: now,
  };
  removeSession(session);
  sessionsByDriveId.set(session.driveSessionId, ended);
  return ended;
}

export function touchDynamicDriveSession(
  session: DynamicDriveAccountSessionRecord,
  now: number,
  relaySessionId?: string | null,
): DynamicDriveAccountSessionRecord {
  const next: DynamicDriveAccountSessionRecord = {
    ...session,
    lastHeartbeatAt: now,
    relaySessionId:
      relaySessionId === undefined ? session.relaySessionId : (relaySessionId ?? null),
  };
  indexSession(next);
  return next;
}

export function createDynamicDriveSession(input: {
  userId: string;
  driveSessionId: string;
  relaySessionId?: string | null;
  now: number;
}): DynamicDriveAccountSessionRecord {
  const record: DynamicDriveAccountSessionRecord = {
    id: randomUUID(),
    userId: input.userId,
    driveSessionId: input.driveSessionId,
    relaySessionId: input.relaySessionId ?? null,
    startedAt: input.now,
    lastHeartbeatAt: input.now,
    endedAt: null,
    status: "active",
  };
  indexSession(record);
  return record;
}

export function toDynamicDriveSessionSnapshot(
  session: DynamicDriveAccountSessionRecord | null,
): import("@/lib/dynamic-drive-session/types").DynamicDriveSessionSnapshot {
  if (!session || session.status !== "active") {
    return {
      activeDriveSessionId: null,
      relaySessionId: null,
      lastHeartbeatAt: null,
    };
  }
  return {
    activeDriveSessionId: session.driveSessionId,
    relaySessionId: session.relaySessionId,
    lastHeartbeatAt: session.lastHeartbeatAt,
  };
}

export function resetDynamicDriveSessionStoreForTests(): void {
  sessionsByUser.clear();
  sessionsByDriveId.clear();
}

/** Allows end calls shortly after the final heartbeat without treating the lease as stale. */
export function isWithinDynamicDriveSessionEndGrace(
  session: DynamicDriveAccountSessionRecord,
  now: number,
): boolean {
  return now - session.lastHeartbeatAt <= DYNAMIC_DRIVE_SESSION_END_GRACE_MS;
}
