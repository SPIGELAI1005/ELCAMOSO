import { DynamicDriveSessionConflictError } from "@/lib/dynamic-drive-session/conflict-error";
import { DYNAMIC_DRIVE_SESSION_CONFLICT_MESSAGE } from "@/lib/dynamic-drive-session/config";
import {
  createDynamicDriveSession,
  endDynamicDriveSession,
  getActiveDynamicDriveSessionForUser,
  getDynamicDriveSessionByDriveSessionId,
  isDynamicDriveSessionStale,
  isWithinDynamicDriveSessionEndGrace,
  purgeStaleDynamicDriveSessions,
  toDynamicDriveSessionSnapshot,
  touchDynamicDriveSession,
} from "@/lib/dynamic-drive-session/store";
import type {
  ClaimDynamicDriveSessionResult,
  DynamicDriveSessionSnapshot,
  HeartbeatDynamicDriveSessionResult,
  ReleaseDynamicDriveSessionResult,
} from "@/lib/dynamic-drive-session/types";

export { DynamicDriveSessionConflictError } from "@/lib/dynamic-drive-session/conflict-error";

export class DynamicDriveSessionService {
  async getSnapshot(userId: string, now = Date.now()): Promise<DynamicDriveSessionSnapshot> {
    purgeStaleDynamicDriveSessions(now);
    const active = getActiveDynamicDriveSessionForUser(userId);
    return toDynamicDriveSessionSnapshot(active);
  }

  async claimSession(input: {
    userId: string;
    driveSessionId: string;
    relaySessionId?: string | null;
    now?: number;
  }): Promise<ClaimDynamicDriveSessionResult> {
    const now = input.now ?? Date.now();
    if (!input.driveSessionId.trim()) throw new Error("driveSessionId is required");

    purgeStaleDynamicDriveSessions(now);

    const sameTab = getDynamicDriveSessionByDriveSessionId(input.driveSessionId);
    if (sameTab?.userId === input.userId && sameTab.status === "active") {
      const resumed = touchDynamicDriveSession(sameTab, now, input.relaySessionId);
      return {
        ok: true,
        resumed: true,
        sessionId: resumed.id,
        snapshot: toDynamicDriveSessionSnapshot(resumed),
      };
    }

    const existing = getActiveDynamicDriveSessionForUser(input.userId);
    if (existing) {
      if (existing.driveSessionId === input.driveSessionId) {
        const resumed = touchDynamicDriveSession(existing, now, input.relaySessionId);
        return {
          ok: true,
          resumed: true,
          sessionId: resumed.id,
          snapshot: toDynamicDriveSessionSnapshot(resumed),
        };
      }

      if (!isDynamicDriveSessionStale(existing, now)) {
        const snapshot = toDynamicDriveSessionSnapshot(existing);
        return {
          ok: false,
          reason: "conflict",
          message: DYNAMIC_DRIVE_SESSION_CONFLICT_MESSAGE,
          snapshot,
        };
      }

      endDynamicDriveSession(existing, now);
    }

    const created = createDynamicDriveSession({
      userId: input.userId,
      driveSessionId: input.driveSessionId,
      ...(input.relaySessionId !== undefined ? { relaySessionId: input.relaySessionId } : {}),
      now,
    });

    return {
      ok: true,
      resumed: false,
      sessionId: created.id,
      snapshot: toDynamicDriveSessionSnapshot(created),
    };
  }

  async heartbeat(input: {
    userId: string;
    driveSessionId: string;
    relaySessionId?: string | null;
    now?: number;
  }): Promise<HeartbeatDynamicDriveSessionResult> {
    const now = input.now ?? Date.now();
    purgeStaleDynamicDriveSessions(now);

    const session = getDynamicDriveSessionByDriveSessionId(input.driveSessionId);
    if (!session || session.userId !== input.userId || session.status !== "active") {
      throw new Error("Dynamic Drive session not found");
    }

    const active = touchDynamicDriveSession(session, now, input.relaySessionId);
    return { snapshot: toDynamicDriveSessionSnapshot(active) };
  }

  async releaseSession(input: {
    userId: string;
    driveSessionId: string;
    now?: number;
  }): Promise<ReleaseDynamicDriveSessionResult> {
    const now = input.now ?? Date.now();
    purgeStaleDynamicDriveSessions(now);

    const session = getDynamicDriveSessionByDriveSessionId(input.driveSessionId);
    if (!session || session.userId !== input.userId || session.status !== "active") {
      return { snapshot: await this.getSnapshot(input.userId, now) };
    }

    if (
      !isWithinDynamicDriveSessionEndGrace(session, now) &&
      isDynamicDriveSessionStale(session, now)
    ) {
      endDynamicDriveSession(session, now);
      return { snapshot: await this.getSnapshot(input.userId, now) };
    }

    endDynamicDriveSession(session, now);
    return { snapshot: await this.getSnapshot(input.userId, now) };
  }
}

let serviceInstance: DynamicDriveSessionService | null = null;

export function getDynamicDriveSessionService(): DynamicDriveSessionService {
  if (!serviceInstance) serviceInstance = new DynamicDriveSessionService();
  return serviceInstance;
}

export function resetDynamicDriveSessionServiceForTests(): void {
  serviceInstance = null;
}
