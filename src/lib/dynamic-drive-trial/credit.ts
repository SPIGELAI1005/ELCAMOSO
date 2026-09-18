import {
  DYNAMIC_DRIVE_TRIAL_END_GRACE_MS,
  DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS,
} from "@/lib/dynamic-drive-trial/config";
import type {
  DynamicDriveTrialRecord,
  DynamicDriveTrialSnapshot,
  DynamicDriveTrialStatus,
} from "@/lib/dynamic-drive-trial/types";

/** Credit elapsed Dynamic Drive seconds between server timestamps. Client clocks are ignored. */
export function creditElapsedSeconds(opts: {
  lastCreditedAt: Date;
  now: Date;
  dynamicDriveEnabled: boolean;
  remainingSeconds: number;
  /** End-of-session allows a small grace beyond the last heartbeat. */
  allowEndGrace?: boolean;
}): number {
  const {
    lastCreditedAt,
    now,
    dynamicDriveEnabled,
    remainingSeconds,
    allowEndGrace = false,
  } = opts;
  if (!dynamicDriveEnabled || remainingSeconds <= 0) return 0;

  const rawMs = now.getTime() - lastCreditedAt.getTime();
  if (rawMs <= 0) return 0;

  const capMs = allowEndGrace
    ? DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS + DYNAMIC_DRIVE_TRIAL_END_GRACE_MS
    : DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS;
  const cappedMs = Math.min(rawMs, capMs);
  const seconds = Math.floor(cappedMs / 1000);
  return Math.min(seconds, remainingSeconds);
}

export function remainingTrialSeconds(trial: DynamicDriveTrialRecord): number {
  return Math.max(0, trial.allocatedSeconds - trial.usedSeconds);
}

export function remainingTrialSessions(trial: DynamicDriveTrialRecord): number {
  return Math.max(0, trial.allocatedSessions - trial.usedSessions);
}

export function resolveTrialStatus(
  trial: DynamicDriveTrialRecord,
  now: Date,
): DynamicDriveTrialStatus {
  if (trial.status === "converted") return "converted";
  if (trial.status === "expired") return "expired";
  if (trial.expiresAt && trial.expiresAt.getTime() <= now.getTime()) return "expired";
  if (trial.usedSeconds >= trial.allocatedSeconds) return "exhausted";
  return trial.status;
}

export function effectiveTrialStatus(
  trial: DynamicDriveTrialRecord,
  now: Date,
  hasActiveSession: boolean,
): DynamicDriveTrialStatus {
  const base = resolveTrialStatus(trial, now);
  if (base === "converted" || base === "expired" || base === "exhausted") return base;
  if (trial.usedSessions >= trial.allocatedSessions && !hasActiveSession) return "exhausted";
  return base;
}

export function canUseDynamicDriveTrial(
  trial: DynamicDriveTrialRecord,
  now: Date,
  hasActiveSession: boolean,
): boolean {
  const status = effectiveTrialStatus(trial, now, hasActiveSession);
  if (status === "converted" || status === "expired" || status === "available") return false;
  if (remainingTrialSeconds(trial) <= 0) return false;
  if (hasActiveSession) return status === "active" || status === "exhausted";
  return status === "active" && remainingTrialSessions(trial) > 0;
}

export function toTrialSnapshot(
  trial: DynamicDriveTrialRecord,
  now: Date,
  activeDriveSessionId: string | null,
): DynamicDriveTrialSnapshot {
  const hasActiveSession = activeDriveSessionId != null;
  const effectiveStatus = effectiveTrialStatus(trial, now, hasActiveSession);
  const remainingSeconds = remainingTrialSeconds(trial);
  const remainingSessions = remainingTrialSessions(trial);
  const canUse = canUseDynamicDriveTrial(trial, now, hasActiveSession);

  return {
    userId: trial.userId,
    status: effectiveStatus,
    startedAt: trial.startedAt?.getTime() ?? null,
    expiresAt: trial.expiresAt?.getTime() ?? null,
    allocatedSeconds: trial.allocatedSeconds,
    usedSeconds: trial.usedSeconds,
    remainingSeconds,
    allocatedSessions: trial.allocatedSessions,
    usedSessions: trial.usedSessions,
    remainingSessions,
    canStartPreview: effectiveStatus === "available",
    canUseDynamicDrive: canUse,
    activeDriveSessionId,
  };
}
