/** Server-only DB helpers for admin foundations. All are no-ops without DATABASE_URL. */
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { hashToken } from "@/lib/account/session-store";
import { getDb } from "@/lib/db/client";
import { accountSessions, adminAuditLog, subscriptions, users } from "@/lib/db/schema";
import { getAccountSession } from "@/lib/account/auth-service";
import { assertAdmin, type AdminIdentity } from "@/lib/admin/admin-access";

function hasDb(): boolean {
  return Boolean(process.env["DATABASE_URL"]);
}

export async function persistAccountSession(input: {
  token: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}): Promise<void> {
  if (!hasDb()) return;
  await getDb()
    .insert(accountSessions)
    .values({
      tokenHash: hashToken(input.token),
      userId: input.userId,
      email: input.email.toLowerCase(),
      createdAt: new Date(input.createdAt),
      expiresAt: new Date(input.expiresAt),
    })
    .onConflictDoNothing();
}

export async function revokeAccountSession(rawToken: string): Promise<void> {
  if (!hasDb()) return;
  const tokenHash = hashToken(rawToken);
  await getDb()
    .update(accountSessions)
    .set({ revokedAt: new Date() })
    .where(eq(accountSessions.tokenHash, tokenHash));
}

export async function isAccountSessionRevoked(rawToken: string): Promise<boolean> {
  if (!hasDb()) return false;
  const rows = await getDb()
    .select({ id: accountSessions.tokenHash })
    .from(accountSessions)
    .where(
      and(eq(accountSessions.tokenHash, hashToken(rawToken)), isNotNull(accountSessions.revokedAt)),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getUserRoleByEmail(email: string): Promise<"user" | "admin" | null> {
  if (!hasDb()) return null;
  const rows = await getDb()
    .select({ role: users.role })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function writeAdminAudit(
  admin: AdminIdentity,
  action: string,
  details: { target?: string; before?: unknown; after?: unknown } = {},
): Promise<void> {
  if (!hasDb()) return;
  await getDb()
    .insert(adminAuditLog)
    .values({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action,
      target: details.target ?? null,
      before: (details.before ?? null) as never,
      after: (details.after ?? null) as never,
    });
}

export function requireAdmin(sessionToken: string | null | undefined): Promise<AdminIdentity> {
  return assertAdmin(sessionToken, {
    getSession: (t) => getAccountSession(t),
    isSessionRevoked: isAccountSessionRevoked,
    getDbRole: getUserRoleByEmail,
  });
}

export interface AdminOverview {
  admin: AdminIdentity;
  databaseConfigured: boolean;
  userCount: number | null;
  subscriptionCount: number | null;
  activeSessionCount: number | null;
  recentAudit: Array<{ action: string; adminEmail: string; target: string | null; at: string }>;
  deploySha: string | null;
}

export async function loadAdminOverview(admin: AdminIdentity): Promise<AdminOverview> {
  const base: AdminOverview = {
    admin,
    databaseConfigured: hasDb(),
    userCount: null,
    subscriptionCount: null,
    activeSessionCount: null,
    recentAudit: [],
    deploySha: process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ?? null,
  };
  if (!hasDb()) return base;
  try {
    const db = getDb();
    const [u] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    const [s] = await db.select({ n: sql<number>`count(*)::int` }).from(subscriptions);
    const [a] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(accountSessions)
      .where(sql`${accountSessions.revokedAt} is null and ${accountSessions.expiresAt} > now()`);
    const audit = await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.at)).limit(20);
    return {
      ...base,
      userCount: u?.n ?? 0,
      subscriptionCount: s?.n ?? 0,
      activeSessionCount: a?.n ?? 0,
      recentAudit: audit.map((r) => ({
        action: r.action,
        adminEmail: r.adminEmail,
        target: r.target,
        at: r.at.toISOString(),
      })),
    };
  } catch (error) {
    console.error("[admin overview]", error instanceof Error ? error.message : error);
    return base;
  }
}
