export type DynamicDriveTrialStatus =
  | "available"
  | "active"
  | "exhausted"
  | "expired"
  | "converted";

export type DynamicDriveTrialSessionStatus = "active" | "ended";

export interface DynamicDriveTrialRecord {
  id: string;
  userId: string;
  startedAt: Date | null;
  expiresAt: Date | null;
  allocatedSeconds: number;
  usedSeconds: number;
  allocatedSessions: number;
  usedSessions: number;
  status: DynamicDriveTrialStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DynamicDriveTrialSessionRecord {
  id: string;
  trialId: string;
  userId: string;
  driveSessionId: string;
  startedAt: Date;
  lastHeartbeatAt: Date;
  lastCreditedAt: Date;
  endedAt: Date | null;
  creditedSeconds: number;
  status: DynamicDriveTrialSessionStatus;
}

/** Client-facing trial snapshot from server authority. */
export interface DynamicDriveTrialSnapshot {
  userId: string;
  status: DynamicDriveTrialStatus;
  startedAt: number | null;
  expiresAt: number | null;
  allocatedSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  allocatedSessions: number;
  usedSessions: number;
  remainingSessions: number;
  canStartPreview: boolean;
  canUseDynamicDrive: boolean;
  activeDriveSessionId: string | null;
}

export interface StartTrialSessionResult {
  snapshot: DynamicDriveTrialSnapshot;
  driveSessionId: string;
  resumed: boolean;
}

export interface HeartbeatTrialSessionResult {
  snapshot: DynamicDriveTrialSnapshot;
  creditedSeconds: number;
}

export interface EndTrialSessionResult {
  snapshot: DynamicDriveTrialSnapshot;
  creditedSeconds: number;
}
