import { randomUUID } from "node:crypto";

import { DYNAMIC_DRIVE_SESSION_STALE_MS } from "@/lib/dynamic-drive-session/config";
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";

import {
  DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS,
  DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS,
  dynamicDriveTrialExpiresAt,
} from "@/lib/dynamic-drive-trial/config";
import {
  creditElapsedSeconds,
  effectiveTrialStatus,
  remainingTrialSeconds,
  remainingTrialSessions,
  toTrialSnapshot,
} from "@/lib/dynamic-drive-trial/credit";
import {
  memoryDynamicDriveTrialRepository,
  type DynamicDriveTrialRepository,
} from "@/lib/dynamic-drive-trial/repository-memory";
import type {
  DynamicDriveTrialRecord,
  DynamicDriveTrialSessionRecord,
  DynamicDriveTrialSnapshot,
  EndTrialSessionResult,
  HeartbeatTrialSessionResult,
  StartTrialSessionResult,
} from "@/lib/dynamic-drive-trial/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DynamicDriveTrialSessionConflictError extends Error {
  constructor(message = "Dynamic Drive is active on another device.") {
    super(message);
    this.name = "DynamicDriveTrialSessionConflictError";
  }
}

export function isTrialUserId(userId: string): boolean {
  return UUID_RE.test(userId);
}

function userHasPaidDrivePlus(userId: string, now: Date): boolean {
  const subscription = getSubscriptionForUser(userId);
  if (!subscription) return false;
  return hasDrivePlusSubscriptionAccess(subscription, now.getTime());
}

function createDefaultTrial(userId: string, now: Date): DynamicDriveTrialRecord {
  return {
    id: randomUUID(),
    userId,
    startedAt: null,
    expiresAt: null,
    allocatedSeconds: DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS,
    usedSeconds: 0,
    allocatedSessions: DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS,
    usedSessions: 0,
    status: "available",
    createdAt: now,
    updatedAt: now,
  };
}

async function loadTrial(
  repo: DynamicDriveTrialRepository,
  userId: string,
  now: Date,
): Promise<DynamicDriveTrialRecord> {
  const existing = await repo.getTrialByUserId(userId);
  if (existing) return existing;
  return repo.saveTrial(createDefaultTrial(userId, now));
}

async function getActiveSessionId(
  repo: DynamicDriveTrialRepository,
  trialId: string,
): Promise<string | null> {
  const active = await repo.getActiveSessionForTrial(trialId);
  return active?.driveSessionId ?? null;
}

async function applyCredit(
  trial: DynamicDriveTrialRecord,
  session: DynamicDriveTrialSessionRecord,
  dynamicDriveEnabled: boolean,
  now: Date,
  allowEndGrace: boolean,
): Promise<{
  trial: DynamicDriveTrialRecord;
  session: DynamicDriveTrialSessionRecord;
  credited: number;
}> {
  const remaining = remainingTrialSeconds(trial);
  const credited = creditElapsedSeconds({
    lastCreditedAt: session.lastCreditedAt,
    now,
    dynamicDriveEnabled,
    remainingSeconds: remaining,
    allowEndGrace,
  });

  if (credited <= 0) {
    return {
      trial,
      session: { ...session, lastHeartbeatAt: now },
      credited: 0,
    };
  }

  const nextSession: DynamicDriveTrialSessionRecord = {
    ...session,
    creditedSeconds: session.creditedSeconds + credited,
    lastCreditedAt: now,
    lastHeartbeatAt: now,
  };
  const nextTrial: DynamicDriveTrialRecord = {
    ...trial,
    usedSeconds: trial.usedSeconds + credited,
    updatedAt: now,
  };

  return { trial: nextTrial, session: nextSession, credited };
}

async function finalizeSession(
  repo: DynamicDriveTrialRepository,
  trial: DynamicDriveTrialRecord,
  session: DynamicDriveTrialSessionRecord,
  dynamicDriveEnabled: boolean,
  now: Date,
): Promise<{
  trial: DynamicDriveTrialRecord;
  session: DynamicDriveTrialSessionRecord;
  credited: number;
}> {
  const credited = await applyCredit(trial, session, dynamicDriveEnabled, now, true);
  const endedSession: DynamicDriveTrialSessionRecord = {
    ...credited.session,
    status: "ended",
    endedAt: now,
    lastHeartbeatAt: now,
  };
  await repo.saveSession(endedSession);

  let nextTrial = credited.trial;
  const hasActive = false;
  const status = effectiveTrialStatus(nextTrial, now, hasActive);
  if (status === "exhausted" || status === "expired") {
    nextTrial = { ...nextTrial, status, updatedAt: now };
    nextTrial = await repo.saveTrial(nextTrial);
  } else {
    nextTrial = await repo.saveTrial(nextTrial);
  }

  return { trial: nextTrial, session: endedSession, credited: credited.credited };
}

export class DynamicDriveTrialService {
  constructor(private readonly repo: DynamicDriveTrialRepository) {}

  /** Paid Drive+ subscribers never consume trial balance - convert once and skip credits. */
  private async maybeConvertPaidSubscriber(
    userId: string,
    now: Date,
  ): Promise<DynamicDriveTrialSnapshot | null> {
    if (!userHasPaidDrivePlus(userId, now)) return null;

    const trial = await loadTrial(this.repo, userId, now);
    if (trial.status !== "converted") {
      return this.completeTrial(userId, now);
    }

    const activeDriveSessionId = await getActiveSessionId(this.repo, trial.id);
    return toTrialSnapshot(trial, now, activeDriveSessionId);
  }

  async getStatus(userId: string, now = new Date()): Promise<DynamicDriveTrialSnapshot> {
    if (!isTrialUserId(userId)) throw new Error("Invalid user id");
    const trial = await loadTrial(this.repo, userId, now);
    const activeDriveSessionId = await getActiveSessionId(this.repo, trial.id);
    const hasActive = activeDriveSessionId != null;
    const status = effectiveTrialStatus(trial, now, hasActive);
    const synced =
      status !== trial.status
        ? await this.repo.saveTrial({ ...trial, status, updatedAt: now })
        : trial;
    return toTrialSnapshot(synced, now, activeDriveSessionId);
  }

  /** Explicit preview activation - starts the 14-day trial window. */
  async startPreview(userId?: string, now = new Date()): Promise<DynamicDriveTrialSnapshot> {
    const resolvedUserId = await this.repo.ensureUser(userId);
    if (!isTrialUserId(resolvedUserId)) throw new Error("Invalid user id");

    let trial = await loadTrial(this.repo, resolvedUserId, now);
    const activeDriveSessionId = await getActiveSessionId(this.repo, trial.id);
    const status = effectiveTrialStatus(trial, now, activeDriveSessionId != null);

    if (status === "converted" || status === "expired" || status === "exhausted") {
      return toTrialSnapshot({ ...trial, status }, now, activeDriveSessionId);
    }

    if (status === "active") {
      return toTrialSnapshot(trial, now, activeDriveSessionId);
    }

    trial = await this.repo.saveTrial({
      ...trial,
      status: "active",
      startedAt: now,
      expiresAt: dynamicDriveTrialExpiresAt(now),
      updatedAt: now,
    });

    return toTrialSnapshot(trial, now, activeDriveSessionId);
  }

  async startDriveSession(
    userId: string,
    driveSessionId: string,
    now = new Date(),
  ): Promise<StartTrialSessionResult> {
    if (!isTrialUserId(userId)) throw new Error("Invalid user id");
    if (!driveSessionId.trim()) throw new Error("driveSessionId is required");

    const paidSnapshot = await this.maybeConvertPaidSubscriber(userId, now);
    if (paidSnapshot) {
      return { snapshot: paidSnapshot, driveSessionId, resumed: true };
    }

    let trial = await loadTrial(this.repo, userId, now);
    let activeDriveSessionId = await getActiveSessionId(this.repo, trial.id);
    let status = effectiveTrialStatus(trial, now, activeDriveSessionId != null);

    if (status !== "active" && status !== "exhausted") {
      throw new Error("Dynamic Drive trial is not active");
    }
    if (remainingTrialSeconds(trial) <= 0) {
      throw new Error("Dynamic Drive trial time exhausted");
    }

    const existing = await this.repo.getSessionByDriveSessionId(trial.id, driveSessionId);
    if (existing?.status === "active") {
      const resumed = await this.repo.saveSession({
        ...existing,
        lastHeartbeatAt: now,
      });
      return {
        snapshot: toTrialSnapshot(trial, now, resumed.driveSessionId),
        driveSessionId,
        resumed: true,
      };
    }

    if (remainingTrialSessions(trial) <= 0) {
      throw new Error("Dynamic Drive trial sessions exhausted");
    }

    if (activeDriveSessionId && activeDriveSessionId !== driveSessionId) {
      const prior = await this.repo.getSessionByDriveSessionId(trial.id, activeDriveSessionId);
      if (prior?.status === "active") {
        const stale =
          now.getTime() - prior.lastHeartbeatAt.getTime() > DYNAMIC_DRIVE_SESSION_STALE_MS;
        if (!stale) {
          throw new DynamicDriveTrialSessionConflictError();
        }
        const finalized = await finalizeSession(this.repo, trial, prior, true, now);
        trial = finalized.trial;
        activeDriveSessionId = null;
      }
    }

    status = effectiveTrialStatus(trial, now, false);
    if (status !== "active") throw new Error("Dynamic Drive trial is not active");

    const session: DynamicDriveTrialSessionRecord = {
      id: randomUUID(),
      trialId: trial.id,
      userId,
      driveSessionId,
      startedAt: now,
      lastHeartbeatAt: now,
      lastCreditedAt: now,
      endedAt: null,
      creditedSeconds: 0,
      status: "active",
    };
    await this.repo.saveSession(session);

    trial = await this.repo.saveTrial({
      ...trial,
      usedSessions: trial.usedSessions + 1,
      updatedAt: now,
    });

    return {
      snapshot: toTrialSnapshot(trial, now, driveSessionId),
      driveSessionId,
      resumed: false,
    };
  }

  async heartbeat(
    userId: string,
    driveSessionId: string,
    dynamicDriveEnabled: boolean,
    now = new Date(),
  ): Promise<HeartbeatTrialSessionResult> {
    if (!isTrialUserId(userId)) throw new Error("Invalid user id");

    const paidSnapshot = await this.maybeConvertPaidSubscriber(userId, now);
    if (paidSnapshot) {
      return { snapshot: paidSnapshot, creditedSeconds: 0 };
    }

    let trial = await loadTrial(this.repo, userId, now);
    const session = await this.repo.getSessionByDriveSessionId(trial.id, driveSessionId);
    if (!session || session.status !== "active") {
      throw new Error("Trial drive session not found");
    }

    const applied = await applyCredit(trial, session, dynamicDriveEnabled, now, false);
    trial = await this.repo.saveTrial(applied.trial);
    await this.repo.saveSession(applied.session);

    const activeDriveSessionId = applied.session.status === "active" ? driveSessionId : null;
    const status = effectiveTrialStatus(trial, now, activeDriveSessionId != null);
    if (status === "exhausted" || status === "expired") {
      trial = await this.repo.saveTrial({ ...trial, status, updatedAt: now });
    }

    return {
      snapshot: toTrialSnapshot(trial, now, activeDriveSessionId),
      creditedSeconds: applied.credited,
    };
  }

  async endDriveSession(
    userId: string,
    driveSessionId: string,
    dynamicDriveEnabled: boolean,
    now = new Date(),
  ): Promise<EndTrialSessionResult> {
    if (!isTrialUserId(userId)) throw new Error("Invalid user id");

    const trial = await loadTrial(this.repo, userId, now);
    const session = await this.repo.getSessionByDriveSessionId(trial.id, driveSessionId);
    if (!session || session.status !== "active") {
      return {
        snapshot: toTrialSnapshot(trial, now, null),
        creditedSeconds: 0,
      };
    }

    const finalized = await finalizeSession(this.repo, trial, session, dynamicDriveEnabled, now);
    return {
      snapshot: toTrialSnapshot(finalized.trial, now, null),
      creditedSeconds: finalized.credited,
    };
  }

  async completeTrial(userId: string, now = new Date()): Promise<DynamicDriveTrialSnapshot> {
    if (!isTrialUserId(userId)) throw new Error("Invalid user id");

    let trial = await loadTrial(this.repo, userId, now);
    const active = await this.repo.getActiveSessionForTrial(trial.id);
    if (active) {
      const finalized = await finalizeSession(this.repo, trial, active, false, now);
      trial = finalized.trial;
    }

    trial = await this.repo.saveTrial({
      ...trial,
      status: "converted",
      updatedAt: now,
    });

    return toTrialSnapshot(trial, now, null);
  }
}

let serviceInstance: DynamicDriveTrialService | null = null;

export function getDynamicDriveTrialService(
  repo: DynamicDriveTrialRepository = memoryDynamicDriveTrialRepository,
): DynamicDriveTrialService {
  if (repo === memoryDynamicDriveTrialRepository) {
    if (!serviceInstance) serviceInstance = new DynamicDriveTrialService(repo);
    return serviceInstance;
  }
  return new DynamicDriveTrialService(repo);
}

export function resetDynamicDriveTrialServiceForTests(): void {
  serviceInstance = null;
}
