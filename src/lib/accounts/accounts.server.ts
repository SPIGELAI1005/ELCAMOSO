/**
 * Server-only account admin + promo + device-link helpers (Supabase Postgres via DATABASE_URL).
 * Every function is a safe no-op / clear error without DATABASE_URL so the app keeps working.
 */
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { AdminIdentity } from "@/lib/admin/admin-access";
import { writeAdminAudit } from "@/lib/admin/admin-store.server";
import { ensureUserRow, invalidateDurableBillingCache } from "@/lib/billing/durable-state.server";
import { getDb } from "@/lib/db/client";
import {
  accountDevices,
  entitlementGrants,
  promoCodes,
  promoRedemptions,
  subscriptions,
  users,
} from "@/lib/db/schema";
import { entitlementsForPlan } from "@/lib/entitlements/plans";

export const hasAccountsDb = () => Boolean(process.env["DATABASE_URL"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTALL_RE = /^elc-[a-z0-9-]{4,40}$/i;
export const PROMO_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export class AccountsError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
function need() {
  if (!hasAccountsDb()) throw new AccountsError("Database not configured", 503);
  return getDb();
}
const daysFromNow = (d: number | null | undefined) =>
  d && d > 0 ? new Date(Date.now() + Math.min(d, 3650) * 86400_000) : null;

/** Drive+ = every entitlement the DRIVE_PLUS plan carries. */
export const drivePlusEntitlements = () => [...entitlementsForPlan("DRIVE_PLUS")];

async function upsertGrant(
  userId: string,
  kind: "admin_profile" | "admin_entitlement" | "promo_profile" | "promo_entitlement",
  target: { profileId?: string; entitlement?: string },
  expiresAt: Date | null,
  source: string,
) {
  const db = need();
  const where = and(
    eq(entitlementGrants.userId, userId),
    eq(entitlementGrants.kind, kind),
    target.profileId
      ? eq(entitlementGrants.profileId, target.profileId)
      : eq(entitlementGrants.entitlement, target.entitlement ?? ""),
  );
  const existing = await db.select({ id: entitlementGrants.id }).from(entitlementGrants).where(where).limit(1);
  if (existing[0]) {
    await db.update(entitlementGrants).set({ expiresAt, source }).where(eq(entitlementGrants.id, existing[0].id));
  } else {
    await db.insert(entitlementGrants).values({
      userId,
      kind,
      profileId: target.profileId ?? null,
      entitlement: target.entitlement ?? null,
      expiresAt,
      source,
    });
  }
}

export async function searchUsers(q: string, limit = 25) {
  const db = need();
  const term = q.trim();
  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(
      term
        ? or(ilike(users.email, `%${term.replace(/[%_]/g, "")}%`), UUID_RE.test(term) ? eq(users.id, term) : sql`false`)
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function getUserDetail(userId: string) {
  if (!UUID_RE.test(userId)) throw new AccountsError("Bad user id");
  const db = need();
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new AccountsError("User not found", 404);
  const [grants, subs, devices, promos] = await Promise.all([
    db.select().from(entitlementGrants).where(eq(entitlementGrants.userId, userId)),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db.select().from(accountDevices).where(eq(accountDevices.userId, userId)),
    db.select().from(promoRedemptions).where(eq(promoRedemptions.userId, userId)),
  ]);
  const now = Date.now();
  return {
    user: { id: u.id, email: u.email, role: u.role, createdAt: u.createdAt.toISOString() },
    grants: grants.map((g) => ({
      id: g.id,
      kind: g.kind,
      profileId: g.profileId,
      entitlement: g.entitlement,
      expiresAt: g.expiresAt?.toISOString() ?? null,
      active: !g.expiresAt || g.expiresAt.getTime() > now,
      source: g.source,
    })),
    subscriptions: subs.map((s) => ({
      plan: s.plan,
      status: s.status,
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    })),
    devices: devices.map((d) => ({ installId: d.installId, linkedAt: d.linkedAt.toISOString() })),
    promos: promos.map((p) => p.code),
  };
}

export async function adminGrantSound(admin: AdminIdentity, userId: string, profileId: string, days: number | null) {
  const expiresAt = daysFromNow(days);
  await upsertGrant(userId, "admin_profile", { profileId }, expiresAt, `admin:${admin.email}`);
  invalidateDurableBillingCache(userId);
  await writeAdminAudit(admin, "grant_sound", { target: userId, after: { profileId, expiresAt } });
}

/** Removes every per-user grant for this sound (purchases, rewards, admin, promo). */
export async function adminRemoveSound(admin: AdminIdentity, userId: string, profileId: string) {
  const db = need();
  const before = await db
    .delete(entitlementGrants)
    .where(and(eq(entitlementGrants.userId, userId), eq(entitlementGrants.profileId, profileId)))
    .returning({ kind: entitlementGrants.kind, source: entitlementGrants.source });
  invalidateDurableBillingCache(userId);
  await writeAdminAudit(admin, "remove_sound", { target: userId, before: { profileId, grants: before } });
  return before.length;
}

export async function adminGrantDrivePlus(admin: AdminIdentity, userId: string, days: number) {
  if (!(days > 0)) throw new AccountsError("Days required");
  const expiresAt = daysFromNow(days);
  for (const entitlement of drivePlusEntitlements())
    await upsertGrant(userId, "admin_entitlement", { entitlement }, expiresAt, `admin_drive_plus:${admin.email}`);
  invalidateDurableBillingCache(userId);
  await writeAdminAudit(admin, "grant_drive_plus", { target: userId, after: { days, expiresAt } });
}

export async function adminRevokeDrivePlus(admin: AdminIdentity, userId: string) {
  const db = need();
  await db
    .delete(entitlementGrants)
    .where(
      and(
        eq(entitlementGrants.userId, userId),
        inArray(entitlementGrants.kind, ["admin_entitlement", "promo_entitlement"]),
      ),
    );
  invalidateDurableBillingCache(userId);
  await writeAdminAudit(admin, "revoke_drive_plus", { target: userId });
}

export async function listPromos() {
  const db = need();
  const rows = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)).limit(100);
  return rows.map((r) => ({
    ...r,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function adminUpsertPromo(
  admin: AdminIdentity,
  input: {
    code: string;
    profileIds?: string[];
    drivePlusDays?: number | null;
    grantDays?: number | null;
    maxRedemptions?: number | null;
    expiresInDays?: number | null;
    active?: boolean;
    note?: string;
  },
) {
  const code = input.code.trim().toUpperCase();
  if (!PROMO_RE.test(code)) throw new AccountsError("Code: 3–32 chars, A–Z 0–9 _ -");
  const profileIds = (input.profileIds ?? []).filter((p) => /^[a-z0-9-]{1,64}$/i.test(p)).slice(0, 50);
  if (!profileIds.length && !input.drivePlusDays) throw new AccountsError("Give sounds or Drive+ days");
  const values = {
    code,
    profileIds,
    drivePlusDays: input.drivePlusDays || null,
    grantDays: input.grantDays || null,
    maxRedemptions: input.maxRedemptions || null,
    expiresAt: daysFromNow(input.expiresInDays),
    active: input.active ?? true,
    note: input.note?.slice(0, 200) ?? null,
    createdBy: admin.email,
  };
  await need()
    .insert(promoCodes)
    .values(values)
    .onConflictDoUpdate({ target: promoCodes.code, set: { ...values, createdBy: admin.email } });
  await writeAdminAudit(admin, "upsert_promo", { target: code, after: values });
}

export async function adminSetPromoActive(admin: AdminIdentity, code: string, active: boolean) {
  await need().update(promoCodes).set({ active }).where(eq(promoCodes.code, code));
  await writeAdminAudit(admin, active ? "enable_promo" : "disable_promo", { target: code });
}

export async function redeemPromo(userId: string, rawCode: string) {
  if (!UUID_RE.test(userId)) throw new AccountsError("Sign in to redeem codes", 401);
  const code = rawCode.trim().toUpperCase();
  if (!PROMO_RE.test(code)) throw new AccountsError("Unknown code", 404);
  const db = need();
  const [p] = await db.select().from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
  if (!p || !p.active) throw new AccountsError("Unknown code", 404);
  if (p.expiresAt && p.expiresAt.getTime() < Date.now()) throw new AccountsError("This code has expired", 410);
  if (p.maxRedemptions != null && p.redemptions >= p.maxRedemptions)
    throw new AccountsError("This code has been fully redeemed", 410);
  await ensureUserRow(userId);
  const ins = await db.insert(promoRedemptions).values({ code, userId }).onConflictDoNothing().returning();
  if (!ins.length) throw new AccountsError("You already redeemed this code", 409);
  await db.update(promoCodes).set({ redemptions: sql`${promoCodes.redemptions} + 1` }).where(eq(promoCodes.code, code));
  const exp = daysFromNow(p.grantDays);
  for (const profileId of p.profileIds) await upsertGrant(userId, "promo_profile", { profileId }, exp, `promo:${code}`);
  if (p.drivePlusDays)
    for (const entitlement of drivePlusEntitlements())
      await upsertGrant(userId, "promo_entitlement", { entitlement }, daysFromNow(p.drivePlusDays), `promo:${code}`);
  invalidateDurableBillingCache(userId);
  return { profileIds: p.profileIds, drivePlusDays: p.drivePlusDays };
}

/** Link the anonymous install id (elc-…) used for analytics to this account. */
export async function linkDevice(userId: string, installId: string) {
  if (!hasAccountsDb() || !UUID_RE.test(userId) || !INSTALL_RE.test(installId)) return false;
  await ensureUserRow(userId);
  await getDb()
    .insert(accountDevices)
    .values({ installId, userId })
    .onConflictDoUpdate({ target: accountDevices.installId, set: { userId, lastSeenAt: new Date() } });
  return true;
}

/** Smile Shop: grant (or extend) Drive+ for `days` days. */
/**
 * Time-limited Drive+ that stacks: the new end date is (latest active Drive+ end) + days,
 * where "active" covers Founders Drive+ and any existing promo grant. A permanent grant stays permanent.
 */
export async function grantSmileDrivePlus(
  userId: string,
  days: number,
  source = "smile-shop",
  now = Date.now(),
): Promise<Date | null> {
  const db = need();
  await ensureUserRow(userId);
  const ents = drivePlusEntitlements();
  const existing = await db
    .select({ expiresAt: entitlementGrants.expiresAt })
    .from(entitlementGrants)
    .where(
      and(
        eq(entitlementGrants.userId, userId),
        eq(entitlementGrants.kind, "promo_entitlement"),
        inArray(entitlementGrants.entitlement, ents),
      ),
    );
  if (existing.length && existing.some((g) => g.expiresAt == null)) return null; // already permanent
  let base = now;
  for (const g of existing) if (g.expiresAt) base = Math.max(base, g.expiresAt.getTime());
  try {
    const { loadFounderRecord } = await import("@/lib/founders/founders.server");
    const { FOUNDER_DRIVE_PLUS_UNTIL_MS } = await import("@/lib/founders/founders");
    if ((await loadFounderRecord(userId)).founderAt != null) base = Math.max(base, FOUNDER_DRIVE_PLUS_UNTIL_MS);
  } catch {
    /* founders store unavailable: stack onto grants only */
  }
  const expiresAt = new Date(base + Math.min(days, 3650) * 86400_000);
  for (const entitlement of ents) await upsertGrant(userId, "promo_entitlement", { entitlement }, expiresAt, source);
  invalidateDurableBillingCache(userId);
  return expiresAt;
}
