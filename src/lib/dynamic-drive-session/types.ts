export interface DynamicDriveAccountSessionRecord {
  id: string;
  userId: string;
  driveSessionId: string;
  relaySessionId: string | null;
  startedAt: number;
  lastHeartbeatAt: number;
  endedAt: number | null;
  status: "active" | "ended";
}

export interface DynamicDriveSessionSnapshot {
  activeDriveSessionId: string | null;
  relaySessionId: string | null;
  lastHeartbeatAt: number | null;
}

export type ClaimDynamicDriveSessionResult =
  | {
      ok: true;
      resumed: boolean;
      sessionId: string;
      snapshot: DynamicDriveSessionSnapshot;
    }
  | {
      ok: false;
      reason: "conflict";
      message: string;
      snapshot: DynamicDriveSessionSnapshot;
    };

export interface HeartbeatDynamicDriveSessionResult {
  snapshot: DynamicDriveSessionSnapshot;
}

export interface ReleaseDynamicDriveSessionResult {
  snapshot: DynamicDriveSessionSnapshot;
}
