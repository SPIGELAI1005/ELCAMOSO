import { randomBytes } from "node:crypto";

import type {
  CreateTeslaUpgradeTokenResult,
  ResolveTeslaUpgradeTokenResult,
  TeslaUpgradeTokenRecord,
  TeslaUpgradeTokenStatus,
} from "@/lib/tesla-upgrade/types";

/** Short-lived QR upgrade tokens - non-guessable, single-use. */
export const TESLA_UPGRADE_TOKEN_TTL_MS = 15 * 60 * 1000;

const tokens = new Map<string, TeslaUpgradeTokenRecord>();

function randomUpgradeToken(): string {
  return randomBytes(24).toString("base64url");
}

function purgeExpiredTokens(now = Date.now()) {
  for (const [token, record] of tokens) {
    if (record.expiresAt <= now && record.status === "pending") {
      tokens.set(token, { ...record, status: "expired" });
    }
  }
}

export function resetTeslaUpgradeStoreForTests(): void {
  tokens.clear();
}

export function createTeslaUpgradeToken(input: {
  userId: string | null;
  clientDriveSessionId: string;
  relaySessionId?: string | null;
}): CreateTeslaUpgradeTokenResult {
  purgeExpiredTokens();
  const token = randomUpgradeToken();
  const now = Date.now();
  const record: TeslaUpgradeTokenRecord = {
    token,
    userId: input.userId,
    clientDriveSessionId: input.clientDriveSessionId,
    relaySessionId: input.relaySessionId ?? null,
    status: "pending",
    createdAt: now,
    expiresAt: now + TESLA_UPGRADE_TOKEN_TTL_MS,
    completedAt: null,
  };
  tokens.set(token, record);
  const upgradePath = `/upgrade/${encodeURIComponent(token)}`;
  return {
    token,
    expiresAt: record.expiresAt,
    upgradePath,
    upgradeUrl: upgradePath,
  };
}

export function getTeslaUpgradeToken(token: string): TeslaUpgradeTokenRecord | null {
  purgeExpiredTokens();
  return tokens.get(token) ?? null;
}

export function resolveTeslaUpgradeToken(token: string): ResolveTeslaUpgradeTokenResult {
  const record = getTeslaUpgradeToken(token);
  if (!record) {
    return {
      valid: false,
      expired: true,
      status: "expired",
      userId: null,
      clientDriveSessionId: "",
    };
  }
  const expired = record.expiresAt <= Date.now() || record.status === "expired";
  return {
    valid: record.status === "pending" && !expired,
    expired,
    status: expired && record.status === "pending" ? "expired" : record.status,
    userId: record.userId,
    clientDriveSessionId: record.clientDriveSessionId,
  };
}

export function bindUserToTeslaUpgradeToken(
  token: string,
  userId: string,
): TeslaUpgradeTokenRecord {
  const record = getTeslaUpgradeToken(token);
  if (!record) throw new Error("Upgrade link expired or invalid");
  if (record.status !== "pending") throw new Error("Upgrade link already used");
  if (record.expiresAt <= Date.now()) throw new Error("Upgrade link expired");
  if (record.userId && record.userId !== userId) {
    throw new Error("Sign in with the same account shown in your car");
  }
  const next = { ...record, userId };
  tokens.set(token, next);
  return next;
}

export function completeTeslaUpgradeToken(token: string): TeslaUpgradeTokenRecord | null {
  const record = getTeslaUpgradeToken(token);
  if (!record || record.status !== "pending") return null;
  const next: TeslaUpgradeTokenRecord = {
    ...record,
    status: "completed",
    completedAt: Date.now(),
  };
  tokens.set(token, next);
  return next;
}

export function listPendingTeslaUpgradeTokensForUser(userId: string): TeslaUpgradeTokenRecord[] {
  purgeExpiredTokens();
  return [...tokens.values()].filter(
    (record) => record.userId === userId && record.status === "pending",
  );
}

export function completeTeslaUpgradeTokensForUser(userId: string): TeslaUpgradeTokenRecord[] {
  const pending = listPendingTeslaUpgradeTokensForUser(userId);
  const completed: TeslaUpgradeTokenRecord[] = [];
  for (const record of pending) {
    const done = completeTeslaUpgradeToken(record.token);
    if (done) completed.push(done);
  }
  return completed;
}

export function tokenStatusForTests(token: string): TeslaUpgradeTokenStatus | null {
  return tokens.get(token)?.status ?? null;
}
