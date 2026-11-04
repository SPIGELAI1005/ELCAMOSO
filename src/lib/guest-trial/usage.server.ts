/**
 * Server side of the guest trial: counts free seconds per Berlin day per hashed IP.
 * The raw IP is never stored or logged — only HMAC-SHA256(secret, day + ip).
 * Storage: the app's Postgres (DATABASE_URL) when set, otherwise an in-memory map
 * (local dev / tests). Rows from earlier days are deleted on the next request.
 */
import { createHmac } from "node:crypto";

import { and, eq, lt, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { guestTrialUsage } from "@/lib/db/schema";
import {
  GUEST_TRIAL_DAILY_SECONDS,
  berlinDayKey,
  creditForHeartbeat,
  isGuestTrialWindow,
  remainingGuestSeconds,
} from "@/lib/guest-trial/config";

export interface GuestUsageRow {
  usedSeconds: number;
  lastSeenMs: number | null;
}

export interface GuestUsageStore {
  get(ipHash: string, day: string): Promise<GuestUsageRow | null>;
  put(ipHash: string, day: string, row: GuestUsageRow): Promise<void>;
  purgeBefore(day: string): Promise<void>;
}

export function guestTrialSecret(): string | null {
  const s = process.env["GUEST_TRIAL_IP_SECRET"];
  return s && s.length >= 16 ? s : null;
}

/** Salted, day-scoped hash: the same IP gives a different hash every day. */
export function hashGuestIp(ip: string, day: string, secret: string): string {
  return createHmac("sha256", secret).update(`${day}|${ip.trim().toLowerCase()}`).digest("hex");
}

/** Client IP from the platform's proxy headers (first hop of x-forwarded-for). */
export function clientIpFromRequest(request: Request): string | null {
  const h = request.headers;
  const fwd = h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || h.get("x-real-ip")?.trim() || null;
}

export function createMemoryStore(): GuestUsageStore {
  const map = new Map<string, GuestUsageRow & { day: string }>();
  return {
    async get(ipHash, day) {
      const r = map.get(`${day}:${ipHash}`);
      return r ? { usedSeconds: r.usedSeconds, lastSeenMs: r.lastSeenMs } : null;
    },
    async put(ipHash, day, row) {
      map.set(`${day}:${ipHash}`, { ...row, day });
    },
    async purgeBefore(day) {
      for (const [k, v] of map) if (v.day < day) map.delete(k);
    },
  };
}

function createDbStore(): GuestUsageStore {
  const db = getDb();
  return {
    async get(ipHash, day) {
      const rows = await db
        .select()
        .from(guestTrialUsage)
        .where(and(eq(guestTrialUsage.ipHash, ipHash), eq(guestTrialUsage.day, day)))
        .limit(1);
      const r = rows[0];
      return r ? { usedSeconds: r.usedSeconds, lastSeenMs: r.lastSeenAt.getTime() } : null;
    },
    async put(ipHash, day, row) {
      const lastSeenAt = new Date(row.lastSeenMs ?? Date.now());
      await db
        .insert(guestTrialUsage)
        .values({ ipHash, day, usedSeconds: row.usedSeconds, lastSeenAt })
        .onConflictDoUpdate({
          target: [guestTrialUsage.ipHash, guestTrialUsage.day],
          // Never let a concurrent tab lower the count.
          set: {
            usedSeconds: sql`greatest(${guestTrialUsage.usedSeconds}, ${row.usedSeconds})`,
            lastSeenAt,
          },
        });
    },
    async purgeBefore(day) {
      await db.delete(guestTrialUsage).where(lt(guestTrialUsage.day, day));
    },
  };
}

let memory: GuestUsageStore | null = null;
let override: GuestUsageStore | null = null;
export function setGuestUsageStoreForTests(store: GuestUsageStore | null): void {
  override = store;
}
function store(): GuestUsageStore {
  if (override) return override;
  if (process.env["DATABASE_URL"]) return createDbStore();
  memory ??= createMemoryStore();
  return memory;
}

let lastPurgeDay = "";

export type GuestTrialResult =
  | { mode: "signed_in" }
  | { mode: "inactive" }
  | { mode: "local_only" }
  | { mode: "guest"; usedSeconds: number; remainingSeconds: number; dailySeconds: number; day: string };

/**
 * Record (or just read, when claimedSeconds = 0) guest usage.
 * `signedIn` bypasses everything; outside the window nothing is counted.
 */
export async function recordGuestHeartbeat(input: {
  ip: string | null;
  signedIn: boolean;
  claimedSeconds: number;
  now: number;
  secret?: string | null;
  store?: GuestUsageStore;
}): Promise<GuestTrialResult> {
  if (input.signedIn) return { mode: "signed_in" };
  if (!isGuestTrialWindow(input.now)) return { mode: "inactive" };
  const secret = input.secret === undefined ? guestTrialSecret() : input.secret;
  if (!secret || !input.ip) return { mode: "local_only" };
  const s = input.store ?? store();
  const day = berlinDayKey(input.now);
  if (lastPurgeDay !== day || input.store) {
    lastPurgeDay = day;
    await s.purgeBefore(day);
  }
  const ipHash = hashGuestIp(input.ip, day, secret);
  const row = await s.get(ipHash, day);
  const used = row?.usedSeconds ?? 0;
  const credit = creditForHeartbeat(input.claimedSeconds, row?.lastSeenMs ?? null, input.now);
  const next = Math.min(GUEST_TRIAL_DAILY_SECONDS, used + credit);
  if (credit > 0 || !row) await s.put(ipHash, day, { usedSeconds: next, lastSeenMs: input.now });
  return {
    mode: "guest",
    usedSeconds: next,
    remainingSeconds: remainingGuestSeconds(next),
    dailySeconds: GUEST_TRIAL_DAILY_SECONDS,
    day,
  };
}
