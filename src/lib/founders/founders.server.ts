/**
 * Server-only Founders store. Postgres (users.founder_at / founder_seat / test_crew_opt_in) when
 * DATABASE_URL is set, in-memory fallback otherwise. Seats are assigned atomically under a
 * transaction-scoped advisory lock so the cap can never be exceeded.
 */
import { eq, isNotNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { entitlementsForPlan } from "@/lib/entitlements/plans";
import {
  listAllGrantsForAccount,
  revokeEntitlementGrant,
  upsertEntitlementGrant,
} from "@/lib/entitlements/grants";
import { persistEntitlementGrantsForAccount } from "@/lib/billing/durable-state.server";
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import type { Subscription } from "@/lib/billing/types";
import {
  FOUNDERS_FOREVER_PICK_SOURCE,
  FOUNDERS_PACK_GRANT_SOURCE,
  canMintFounder,
  canMintFounderFromPurchase,
  founderSeatLimit,
  foundersPackUnlimitedUntilMs,
  isFoundersPackQualifyingPlan,
  isFoundersPackQualifyingPurchaseTime,
  isLegacyFounderClaim,
} from "@/lib/founders/founders";
import {
  clearFounderSoundPicks,
  ensureLegacyFounderForeverSounds,
} from "@/lib/founders/sound-picks.server";

export interface FounderRecord {
  founderAt: number | null;
  seat: number | null;
  testCrewOptIn: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_MS = 10_000;
const COUNT_CACHE_MS = 30_000;
const memory = new Map<string, FounderRecord>();
const loadedAt = new Map<string, number>();
let countCache: { n: number; at: number } | null = null;

const dbEnabled = (userId: string) => Boolean(process.env["DATABASE_URL"]) && UUID_RE.test(userId);
const empty = (): FounderRecord => ({ founderAt: null, seat: null, testCrewOptIn: false });

let enabled = true;
/** Tests only: turn Founders resolution off so unrelated entitlement tests stay deterministic. */
export function setFoundersEnabledForTests(on: boolean): void {
  enabled = on;
}
export function foundersEnabled(): boolean {
  return enabled;
}

export function resetFoundersStoreForTests(): void {
  memory.clear();
  loadedAt.clear();
  countCache = null;
}

function memorySeatsTaken(): number {
  let n = 0;
  for (const r of memory.values()) if (r.founderAt != null) n += 1;
  return n;
}

export async function getFounderSeatsTaken(now = Date.now()): Promise<number> {
  if (!process.env["DATABASE_URL"]) return memorySeatsTaken();
  if (countCache && now - countCache.at < COUNT_CACHE_MS) return countCache.n;
  try {
    const rows = await getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(isNotNull(users.founderAt));
    countCache = { n: Number(rows[0]?.n ?? 0), at: now };
    return countCache.n;
  } catch (error) {
    console.error("[founders] count failed", error instanceof Error ? error.message : error);
    return countCache?.n ?? 0;
  }
}

export async function loadFounderRecord(userId: string, now = Date.now()): Promise<FounderRecord> {
  if (!dbEnabled(userId)) return memory.get(userId) ?? empty();
  const last = loadedAt.get(userId);
  const cached = memory.get(userId);
  if (cached && last != null && now - last < CACHE_MS) return cached;
  try {
    const rows = await getDb()
      .select({
        founderAt: users.founderAt,
        seat: users.founderSeat,
        testCrewOptIn: users.testCrewOptIn,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const row = rows[0];
    const rec: FounderRecord = row
      ? {
          founderAt: row.founderAt?.getTime() ?? null,
          seat: row.seat ?? null,
          testCrewOptIn: row.testCrewOptIn,
        }
      : empty();
    memory.set(userId, rec);
    loadedAt.set(userId, now);
    return rec;
  } catch (error) {
    console.error("[founders] load failed", error instanceof Error ? error.message : error);
    return cached ?? empty();
  }
}

type MintFn = (seatsTaken: number, now: number, limit: number) => boolean;

async function mintFounderSeat(
  userId: string,
  email: string | null,
  now: number,
  canMint: MintFn,
  logLabel: string,
): Promise<FounderRecord> {
  const current = await loadFounderRecord(userId, now);
  if (current.founderAt != null) return current;
  const limit = founderSeatLimit();
  if (!canMint(await getFounderSeatsTaken(now), now, limit)) return current;

  if (!dbEnabled(userId)) {
    if (!canMint(memorySeatsTaken(), now, limit)) return current;
    const rec = { ...current, founderAt: now, seat: memorySeatsTaken() + 1 };
    memory.set(userId, rec);
    return rec;
  }

  try {
    const result = await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('elcamoso_founders_seats'))`);
      await tx.insert(users).values({ id: userId, email }).onConflictDoNothing();
      const existing = await tx
        .select({ founderAt: users.founderAt, seat: users.founderSeat })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (existing[0]?.founderAt) {
        return { founderAt: existing[0].founderAt.getTime(), seat: existing[0].seat ?? null };
      }
      const counts = await tx
        .select({
          n: sql<number>`count(*)::int`,
          maxSeat: sql<number>`coalesce(max(${users.founderSeat}), 0)::int`,
        })
        .from(users)
        .where(isNotNull(users.founderAt));
      const taken = Number(counts[0]?.n ?? 0);
      if (!canMint(taken, now, limit)) return null;
      const seat = Number(counts[0]?.maxSeat ?? 0) + 1;
      await tx
        .update(users)
        .set({ founderAt: new Date(now), founderSeat: seat })
        .where(eq(users.id, userId));
      return { founderAt: now, seat };
    });
    countCache = null;
    if (!result) return current;
    const rec = { ...current, ...result };
    memory.set(userId, rec);
    loadedAt.set(userId, now);
    return rec;
  } catch (error) {
    console.error(`[founders] ${logLabel} failed`, error instanceof Error ? error.message : error);
    return current;
  }
}

/**
 * Stamp a verified, signed-in account as Founder if free signup is open and seats remain.
 * Call only for a verified session (every ELCAMOSO sign-in verifies the email).
 */
export async function claimFounderSeat(
  userId: string,
  email: string | null,
  now = Date.now(),
): Promise<FounderRecord> {
  const rec = await mintFounderSeat(userId, email, now, canMintFounder, "claim");
  ensureLegacyFounderForeverSounds(userId, rec.founderAt);
  return rec;
}

/**
 * Stamp a paid Founders Pack buyer as Founder while the purchase window is open
 * (through Black Friday), even after free seat claims have closed.
 */
export async function claimFounderSeatFromPurchase(
  userId: string,
  email: string | null,
  now = Date.now(),
): Promise<FounderRecord> {
  return mintFounderSeat(userId, email, now, canMintFounderFromPurchase, "purchase claim");
}

/** Earliest Founders Pack purchase timestamp from entitlement grants, if any. */
export function foundersPackPurchasedAt(userId: string): number | null {
  const grants = listAllGrantsForAccount(userId).filter(
    (g) => g.source === FOUNDERS_PACK_GRANT_SOURCE,
  );
  if (!grants.length) return null;
  return Math.min(...grants.map((g) => g.createdAt));
}

/**
 * Grant Drive Unlimited (DRIVE_COMPLETE) for 4 months from `purchasedAt`.
 * Idempotent per entitlement. Does not invent a price — caller is the paid webhook.
 */
export function grantFoundersPackUnlimited(userId: string, purchasedAt: number): number {
  const until = foundersPackUnlimitedUntilMs(purchasedAt);
  for (const entitlement of entitlementsForPlan("DRIVE_COMPLETE")) {
    upsertEntitlementGrant({
      accountId: userId,
      kind: "promo_entitlement",
      profileId: null,
      entitlement,
      expiresAt: until,
      createdAt: purchasedAt,
      source: FOUNDERS_PACK_GRANT_SOURCE,
    });
  }
  return until;
}

/**
 * Yearly Drive+ or Drive the Music bought during the Founders Pack window:
 * mint a seat and grant Drive Unlimited for 4 months from purchase.
 */
export async function applyFoundersPackFromYearlySubscription(
  subscription: Pick<Subscription, "userId" | "plan" | "interval" | "status" | "createdAt">,
  now = Date.now(),
  opts?: { purchasedAt?: number },
): Promise<{ applied: boolean; until: number | null }> {
  if (!isFoundersPackQualifyingPlan(subscription.plan, subscription.interval)) {
    return { applied: false, until: null };
  }
  if (!hasDrivePlusSubscriptionAccess(subscription, now)) {
    return { applied: false, until: null };
  }
  const purchasedAt = opts?.purchasedAt ?? subscription.createdAt.getTime();
  if (!isFoundersPackQualifyingPurchaseTime(purchasedAt)) {
    return { applied: false, until: null };
  }
  await claimFounderSeatFromPurchase(subscription.userId, null, purchasedAt);
  const already = foundersPackPurchasedAt(subscription.userId);
  const until = grantFoundersPackUnlimited(subscription.userId, already ?? purchasedAt);
  await persistEntitlementGrantsForAccount(subscription.userId).catch((error: unknown) => {
    console.error(
      "[founders-pack] persist yearly grants failed",
      error instanceof Error ? error.message : error,
    );
  });
  return { applied: true, until };
}

/**
 * Withdrawal within 14 days: refund is processed in Stripe/support.
 * This drops Founders Pack grants and forever picks. Legacy Founder seats stay.
 */
export async function revokeFoundersPackPurchase(userId: string, now = Date.now()): Promise<void> {
  for (const grant of listAllGrantsForAccount(userId)) {
    if (
      grant.source === FOUNDERS_PACK_GRANT_SOURCE ||
      grant.source === FOUNDERS_FOREVER_PICK_SOURCE
    ) {
      revokeEntitlementGrant(grant.id);
    }
  }
  await clearFounderSoundPicks(userId);
  const current = await loadFounderRecord(userId, now);
  if (current.founderAt != null && !isLegacyFounderClaim(current.founderAt)) {
    if (dbEnabled(userId)) {
      await getDb()
        .update(users)
        .set({ founderAt: null, founderSeat: null })
        .where(eq(users.id, userId));
    }
    memory.set(userId, { ...current, founderAt: null, seat: null });
    loadedAt.set(userId, now);
    countCache = null;
  }
  await persistEntitlementGrantsForAccount(userId).catch(() => undefined);
}

export async function setTestCrewOptIn(
  userId: string,
  optIn: boolean,
  now = Date.now(),
): Promise<FounderRecord> {
  const current = await loadFounderRecord(userId, now);
  if (current.founderAt == null) throw new Error("Test Crew is for Founders only");
  if (dbEnabled(userId)) {
    await getDb().update(users).set({ testCrewOptIn: optIn }).where(eq(users.id, userId));
  }
  const rec = { ...current, testCrewOptIn: optIn };
  memory.set(userId, rec);
  loadedAt.set(userId, now);
  return rec;
}
