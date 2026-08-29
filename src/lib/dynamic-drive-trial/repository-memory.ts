import { randomUUID } from "node:crypto";

import type {
  DynamicDriveTrialRecord,
  DynamicDriveTrialSessionRecord,
} from "@/lib/dynamic-drive-trial/types";

export interface DynamicDriveTrialRepository {
  ensureUser(userId?: string): Promise<string>;
  getTrialByUserId(userId: string): Promise<DynamicDriveTrialRecord | null>;
  saveTrial(trial: DynamicDriveTrialRecord): Promise<DynamicDriveTrialRecord>;
  getSessionByDriveSessionId(
    trialId: string,
    driveSessionId: string,
  ): Promise<DynamicDriveTrialSessionRecord | null>;
  getActiveSessionForTrial(trialId: string): Promise<DynamicDriveTrialSessionRecord | null>;
  saveSession(session: DynamicDriveTrialSessionRecord): Promise<DynamicDriveTrialSessionRecord>;
}

const users = new Map<string, true>();
const trials = new Map<string, DynamicDriveTrialRecord>();
const trialsByUser = new Map<string, string>();
const sessions = new Map<string, DynamicDriveTrialSessionRecord>();
const sessionsByDriveId = new Map<string, string>();

function sessionKey(trialId: string, driveSessionId: string): string {
  return `${trialId}:${driveSessionId}`;
}

export function resetDynamicDriveTrialStoreForTests(): void {
  users.clear();
  trials.clear();
  trialsByUser.clear();
  sessions.clear();
  sessionsByDriveId.clear();
}

export const memoryDynamicDriveTrialRepository: DynamicDriveTrialRepository = {
  async ensureUser(userId) {
    const id = userId ?? randomUUID();
    users.set(id, true);
    return id;
  },

  async getTrialByUserId(userId) {
    const trialId = trialsByUser.get(userId);
    if (!trialId) return null;
    return trials.get(trialId) ?? null;
  },

  async saveTrial(trial) {
    trials.set(trial.id, trial);
    trialsByUser.set(trial.userId, trial.id);
    return trial;
  },

  async getSessionByDriveSessionId(trialId, driveSessionId) {
    const id = sessionsByDriveId.get(sessionKey(trialId, driveSessionId));
    if (!id) return null;
    return sessions.get(id) ?? null;
  },

  async getActiveSessionForTrial(trialId) {
    for (const session of sessions.values()) {
      if (session.trialId === trialId && session.status === "active") return session;
    }
    return null;
  },

  async saveSession(session) {
    sessions.set(session.id, session);
    sessionsByDriveId.set(sessionKey(session.trialId, session.driveSessionId), session.id);
    return session;
  },
};
