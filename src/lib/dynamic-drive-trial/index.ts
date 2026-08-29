export {
  DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS,
  DYNAMIC_DRIVE_TRIAL_EXPIRY_DAYS,
  DYNAMIC_DRIVE_TRIAL_HEARTBEAT_INTERVAL_MS,
  DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS,
  DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS,
} from "@/lib/dynamic-drive-trial/config";

export type {
  DynamicDriveTrialRecord,
  DynamicDriveTrialSessionRecord,
  DynamicDriveTrialSessionStatus,
  DynamicDriveTrialSnapshot,
  DynamicDriveTrialStatus,
  EndTrialSessionResult,
  HeartbeatTrialSessionResult,
  StartTrialSessionResult,
} from "@/lib/dynamic-drive-trial/types";

export {
  canUseDynamicDriveTrial,
  creditElapsedSeconds,
  effectiveTrialStatus,
  remainingTrialSeconds,
  remainingTrialSessions,
  toTrialSnapshot,
} from "@/lib/dynamic-drive-trial/credit";

export {
  DynamicDriveTrialService,
  getDynamicDriveTrialService,
  isTrialUserId,
  resetDynamicDriveTrialServiceForTests,
} from "@/lib/dynamic-drive-trial/service";

export {
  memoryDynamicDriveTrialRepository,
  resetDynamicDriveTrialStoreForTests,
  type DynamicDriveTrialRepository,
} from "@/lib/dynamic-drive-trial/repository-memory";

export {
  endDynamicDriveTrialSessionFn,
  getDynamicDriveTrialStatusFn,
  heartbeatDynamicDriveTrialFn,
  startDynamicDriveTrialFn,
  startDynamicDriveTrialSessionFn,
} from "@/lib/dynamic-drive-trial/server-fns";
