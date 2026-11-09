/**
 * Server side of the Black Friday Special 30-minute cap: counts free seconds
 * per Berlin day per signed-in account id. Storage: the app's Postgres
 * (DATABASE_URL) when set, otherwise an in-memory map (local dev / tests).
 * Rows from earlier days are deleted on the next request.
 */
import { and, eq, lt, sql } from "drizzle-orm";

import {
  DRIVE_SPECIAL_DAILY_SECONDS,
  driveSpecialCapApplies,
  isDriveSpecialActive,
  remainingDriveSpecialSeconds,
} from "@/lib/billing/drive-special";
import { getDb } from "@/lib/db/client";
import { driveSpecialUsage } from "@/lib/db/schema";
import type { Entitlement, Plan } from "@/lib/entitlements/types";
import { berlinDayKey, creditForHeartbeat } from "@/lib/guest-trial/config";

export interface DriveSpecialUsageRow {
  usedSeconds: number;
  lastSeenMs: number | null;
}

export interface DriveSpecialUsageStore {
  get(accountId: string, day: string): Promise<DriveSpecialUsageRow | null>;
  put(accountId: string, day: string, row: DriveSpecialUsageRow): Promise<void>;
  purgeBefore(day: string): Promise<void>;
}

export function createMemoryDriveSpecialStore(): DriveSpecialUsageStore {
  const map = new Map<string, DriveSpecialUsageRow & { day: string }>();
  return {
    async get(accountId, day) {
      const r = map.get(`${day}:${accountId}`);
      return r ? { usedSeconds: r.usedSeconds, lastSeenMs: r.lastSeenMs } : null;
    },
    async put(accountId, day, row) {
      map.set(`${day}:${accountId}`, { ...row, day });
    },
    async purgeBefore(day) {
      for (const [k, v] of map) if (v.day < day) map.delete(k);
    },
  };
}

function createDbStore(): DriveSpecialUsageStore {
  const db = getDb();
  return {
    async get(accountId, day) {
      const rows = await db
        .select()
        .from(driveSpecialUsage)
        .where(and(eq(driveSpecialUsage.accountId, accountId), eq(driveSpecialUsage.day, day)))
        .limit(1);
      const r = rows[0];
      return r ? { usedSeconds: r.usedSeconds, lastSeenMs: r.lastSeenAt.getTime() } : null;
    },
    async put(accountId, day, row) {
      const lastSeenAt = new Date(row.lastSeenMs ?? Date.now());
      await db
        .insert(driveSpecialUsage)
        .values({ accountId, day, usedSeconds: row.usedSeconds, lastSeenAt })
        .onConflictDoUpdate({
          target: [driveSpecialUsage.accountId, driveSpecialUsage.day],
          set: {
            usedSeconds: sql`greatest(${driveSpecialUsage.usedSeconds}, ${row.usedSeconds})`,
            lastSeenAt,
          },
        });
    },
    async purgeBefore(day) {
      await db.delete(driveSpecialUsage).where(lt(driveSpecialUsage.day, day));
    },
  };
}

let memory: DriveSpecialUsageStore | null = null;
let override: DriveSpecialUsageStore | null = null;
export function setDriveSpecialUsageStoreForTests(store: DriveSpecialUsageStore | null): void {
  override = store;
}
function store(): DriveSpecialUsageStore {
  if (override) return override;
  if (process.env["DATABASE_URL"]) return createDbStore();
  memory ??= createMemoryDriveSpecialStore();
  return memory;
}

let lastPurgeDay = "";

export type DriveSpecialHeartbeatResult =
  | { mode: "signed_out" }
  | { mode: "inactive" }
  | { mode: "uncapped" }
  | {
      mode: "capped";
      usedSeconds: number;
      remainingSeconds: number;
      dailySeconds: number;
      day: string;
    };

export type DriveSpecialCapAccount = {
  accountId: string | null;
  plan: Plan;
  founderDrivePlusActive?: boolean | null;
  grantedEntitlements?: readonly Entitlement[] | null;
  trialActive?: boolean | null;
  trialEntitlements?: readonly Entitlement[] | null;
};

/**
 * Record (or just read, when claimedSeconds = 0) Black Friday Special usage.
 * Signed-out / outside the window / owners of the music are not counted.
 */
export async function recordDriveSpecialHeartbeat(input: {
  account: DriveSpecialCapAccount;
  claimedSeconds: number;
  now: number;
  store?: DriveSpecialUsageStore;
}): Promise<DriveSpecialHeartbeatResult> {
  const accountId = input.account.accountId;
  if (!accountId) return { mode: "signed_out" };
  if (!isDriveSpecialActive(input.now)) return { mode: "inactive" };
  if (!driveSpecialCapApplies(input.account, input.now)) return { mode: "uncapped" };

  const s = input.store ?? store();
  const day = berlinDayKey(input.now);
  if (lastPurgeDay !== day || input.store) {
    lastPurgeDay = day;
    await s.purgeBefore(day);
  }
  const row = await s.get(accountId, day);
  const used = row?.usedSeconds ?? 0;
  const credit = creditForHeartbeat(input.claimedSeconds, row?.lastSeenMs ?? null, input.now);
  const next = Math.min(DRIVE_SPECIAL_DAILY_SECONDS, used + credit);
  if (credit > 0 || !row) await s.put(accountId, day, { usedSeconds: next, lastSeenMs: input.now });
  return {
    mode: "capped",
    usedSeconds: next,
    remainingSeconds: remainingDriveSpecialSeconds(next),
    dailySeconds: DRIVE_SPECIAL_DAILY_SECONDS,
    day,
  };
}
