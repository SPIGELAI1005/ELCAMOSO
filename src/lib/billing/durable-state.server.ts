/**
 * Durable billing state (server-only).
 *
 * When DATABASE_URL is set, Postgres is the source of truth for subscriptions, Drive+ Lifetime
 * grants and entitlement grants (purchased / reward unlocks). The in-memory stores that the
 * synchronous entitlement resolvers read are refreshed from Postgres per request, with a short
 * per-instance cache, so every serverless instance and every cold start sees the same state.
 *
 * Without DATABASE_URL every function here is a no-op and the memory stores behave as before
 * (local dev fallback).
 */
import { eq } from "drizzle-orm";

import {
  clearLifetimeStateForUser,
  isLifetimeProviderId,
  LIFETIME_PROVIDER_ID_PREFIX,
  lifetimeEntitlementRecord,
  restoreLifetimeGrant,
  setUnderlyingSubscriptionRecord,
  hasActiveLifetimeGrant,
} from "@/lib/billing/lifetime-store";
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import {
  getSubscriptionForUser,
  setSubscriptionForUser,
  type UserSubscriptionRecord,
} from "@/lib/billing/subscription-store";
import type { Subscription } from "@/lib/billing/types";
import { getDb } from "@/lib/db/client";
import { subscriptionRowToSubscription } from "@/lib/db/mappers";
import { entitlementGrants, subscriptions, users } from "@/lib/db/schema";
import {
  listAllGrantsForAccount,
  replaceGrantsForAccount,
  type EntitlementGrant,
} from "@/lib/entitlements/grants";
import type { Entitlement } from "@/lib/entitlements/types";

/** Per-instance cache window. Webhook writes on this instance invalidate immediately. */
export const DURABLE_BILLING_CACHE_MS = 10_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const loadedAt = new Map<string, number>();

export function isDurableBillingEnabled(): boolean {
  return Boolean(process.env["DATABASE_URL"]);
}

export function invalidateDurableBillingCache(userId?: string): void {
  if (userId) loadedAt.delete(userId);
  else loadedAt.clear();
}

export function resetDurableBillingStateForTests(): void {
  loadedAt.clear();
}

function freeRecord(userId: string): UserSubscriptionRecord {
  return {
    userId,
    plan: "FREE",
    status: "free",
    interval: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    pastDueSince: null,
  };
}

function recurringRecord(sub: Subscription, previous: UserSubscriptionRecord | null): UserSubscriptionRecord {
  return {
    userId: sub.userId,
    plan: sub.plan,
    status: sub.status,
    interval: sub.interval,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEnd: sub.currentPeriodEnd,
    // Grace clock: keep the instance's earlier start, else the row's last update time.
    pastDueSince:
      sub.status === "past_due"
        ? previous?.status === "past_due" && previous.pastDueSince
          ? previous.pastDueSince
          : sub.updatedAt
        : null,
  };
}

/** Pick the recurring subscription that should drive access (access-granting first, then newest). */
function pickRecurring(rows: Subscription[], now: number): Subscription | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const withAccess = sorted.find((s) =>
    hasDrivePlusSubscriptionAccess(
      {
        plan: s.plan,
        status: s.status,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        currentPeriodEnd: s.currentPeriodEnd,
        pastDueSince: s.status === "past_due" ? s.updatedAt : null,
      },
      now,
    ),
  );
  return withAccess ?? sorted[0] ?? null;
}

/** Applies durable rows to the runtime stores for one user. Exported for tests. */
export function applyDurableBillingRows(
  userId: string,
  subscriptionRows: Subscription[],
  grantRows: EntitlementGrant[],
  now = Date.now(),
): void {
  const previous = getSubscriptionForUser(userId);
  clearLifetimeStateForUser(userId);

  for (const row of subscriptionRows) {
    if (!isLifetimeProviderId(row.providerSubscriptionId)) continue;
    restoreLifetimeGrant({
      userId,
      paymentIntentId: row.providerSubscriptionId.slice(LIFETIME_PROVIDER_ID_PREFIX.length),
      checkoutSessionId: null,
      stripeCustomerId: row.providerCustomerId || null,
      grantedAt: row.currentPeriodStart ?? row.createdAt,
      revokedAt: row.status === "active" ? null : (row.currentPeriodEnd ?? row.updatedAt),
    });
  }

  const recurring = pickRecurring(
    subscriptionRows.filter((row) => !isLifetimeProviderId(row.providerSubscriptionId)),
    now,
  );
  const recurringState = recurring ? recurringRecord(recurring, previous) : null;
  if (recurringState) setUnderlyingSubscriptionRecord(recurringState);

  if (hasActiveLifetimeGrant(userId)) {
    setSubscriptionForUser(lifetimeEntitlementRecord(userId));
  } else if (recurringState && hasDrivePlusSubscriptionAccess(recurringState, now)) {
    setSubscriptionForUser({ ...recurringState, plan: "DRIVE_PLUS" });
  } else if (recurringState) {
    setSubscriptionForUser(freeRecord(userId));
  } else {
    setSubscriptionForUser(freeRecord(userId));
  }

  replaceGrantsForAccount(userId, grantRows);
}

function grantRowToGrant(row: typeof entitlementGrants.$inferSelect): EntitlementGrant {
  return {
    id: row.id,
    accountId: row.userId,
    kind: row.kind,
    profileId: row.profileId,
    entitlement: (row.entitlement as Entitlement | null) ?? null,
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
    source: row.source,
  };
}

/**
 * Refresh one user's billing + grant state from Postgres. Cached for DURABLE_BILLING_CACHE_MS.
 * On a DB read error the current memory state is kept (fail-soft for reads) and the error logged.
 */
export async function hydrateUserBillingState(
  userId: string | null | undefined,
  options: { force?: boolean; now?: number } = {},
): Promise<boolean> {
  if (!userId || !isDurableBillingEnabled() || !UUID_RE.test(userId)) return false;
  const now = options.now ?? Date.now();
  const last = loadedAt.get(userId);
  if (!options.force && last != null && now - last < DURABLE_BILLING_CACHE_MS) return true;

  try {
    const db = getDb();
    const [subRows, grantRows] = await Promise.all([
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
      db.select().from(entitlementGrants).where(eq(entitlementGrants.userId, userId)),
    ]);
    applyDurableBillingRows(
      userId,
      subRows.map(subscriptionRowToSubscription),
      grantRows.map(grantRowToGrant),
      now,
    );
    loadedAt.set(userId, now);
    return true;
  } catch (error) {
    console.error(
      "[billing] durable hydrate failed",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/** Ensure a users row exists (FK target for subscriptions / grants). */
export async function ensureUserRow(userId: string, email: string | null = null): Promise<void> {
  if (!isDurableBillingEnabled() || !UUID_RE.test(userId)) return;
  await getDb()
    .insert(users)
    .values({ id: userId, email })
    .onConflictDoNothing();
}

/** Write-through every cached entitlement grant for an account to Postgres. Throws on DB error. */
export async function persistEntitlementGrantsForAccount(accountId: string): Promise<number> {
  if (!isDurableBillingEnabled() || !UUID_RE.test(accountId)) return 0;
  const grants = listAllGrantsForAccount(accountId);
  if (grants.length === 0) return 0;
  await ensureUserRow(accountId);
  const db = getDb();
  for (const grant of grants) {
    const values = {
      userId: accountId,
      kind: grant.kind,
      profileId: grant.profileId,
      entitlement: grant.entitlement,
      expiresAt: grant.expiresAt != null ? new Date(grant.expiresAt) : null,
      source: grant.source,
      createdAt: new Date(grant.createdAt),
    };
    await db
      .insert(entitlementGrants)
      .values({ id: UUID_RE.test(grant.id) ? grant.id : undefined, ...values })
      .onConflictDoUpdate({
        target: entitlementGrants.id,
        set: { expiresAt: values.expiresAt, source: values.source, updatedAt: new Date() },
      })
      .catch(async (error: unknown) => {
        // Same (user, kind, profile|entitlement) already stored under another id - update it.
        const where = grant.profileId
          ? eq(entitlementGrants.profileId, grant.profileId)
          : grant.entitlement
            ? eq(entitlementGrants.entitlement, grant.entitlement)
            : null;
        if (!where) throw error;
        const rows = await db.select().from(entitlementGrants).where(where);
        const match = rows.find((r) => r.userId === accountId && r.kind === grant.kind);
        if (!match) throw error;
        await db
          .update(entitlementGrants)
          .set({ expiresAt: values.expiresAt, source: values.source, updatedAt: new Date() })
          .where(eq(entitlementGrants.id, match.id));
      });
  }
  invalidateDurableBillingCache(accountId);
  return grants.length;
}

/**
 * Stable account id per verified email across instances: reuse users.id when the email is
 * already known in Postgres, else store the freshly minted id. Returns null without a DB.
 */
export async function resolveDurableUserIdForEmail(
  email: string,
  mintUserId: () => string,
): Promise<string | null> {
  if (!isDurableBillingEnabled()) return null;
  const normalized = email.trim().toLowerCase();
  try {
    const db = getDb();
    const { sql } = await import("drizzle-orm");
    const find = async () =>
      (
        await db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.email}) = ${normalized}`)
          .limit(1)
      )[0]?.id ?? null;
    const existing = await find();
    if (existing) return existing;
    const id = mintUserId();
    await db.insert(users).values({ id, email: normalized }).onConflictDoNothing();
    return (await find()) ?? id;
  } catch (error) {
    console.error(
      "[account] durable user lookup failed",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
