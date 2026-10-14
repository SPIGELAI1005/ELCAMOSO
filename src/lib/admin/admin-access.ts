/**
 * Admin role resolution. Pure / dependency-injected so it is unit-testable.
 * Admins = bootstrap allowlist (case-insensitive) ∪ ELCAMOSO_ADMIN_EMAILS env ∪ users.role = 'admin'.
 */
export const BOOTSTRAP_ADMIN_EMAILS: readonly string[] = ["george.m.neacsu@googlemail.com"];

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function readAdminEmailAllowlist(
  envValue: string | undefined = process.env["ELCAMOSO_ADMIN_EMAILS"],
): Set<string> {
  const set = new Set(BOOTSTRAP_ADMIN_EMAILS.map(normalizeEmail));
  for (const part of (envValue ?? "").split(/[,;\s]+/)) {
    const e = normalizeEmail(part);
    if (e) set.add(e);
  }
  return set;
}

export function isAllowlistedAdminEmail(
  email: string | null | undefined,
  allowlist = readAdminEmailAllowlist(),
): boolean {
  const e = normalizeEmail(email);
  return e.length > 0 && allowlist.has(e);
}

export class AdminAuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message = status === 401 ? "Authentication required" : "Admin access required",
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export interface AdminIdentity {
  userId: string;
  email: string;
}

export interface AdminGuardDeps {
  /** Verify the signed session ticket / token. Null when invalid or expired. */
  getSession: (token: string) => { userId: string; email: string; token: string } | null;
  /** True when the durable session has been revoked (sign-out). */
  isSessionRevoked?: (rawToken: string) => Promise<boolean>;
  /** Role from the users table, null when unknown / no DB. */
  getDbRole?: (email: string) => Promise<"user" | "admin" | null>;
  allowlist?: Set<string>;
}

/** Server-side guard: throws AdminAuthError(401|403) unless the caller is an admin. */
export async function assertAdmin(
  sessionToken: string | null | undefined,
  deps: AdminGuardDeps,
): Promise<AdminIdentity> {
  const token = sessionToken?.trim();
  if (!token) throw new AdminAuthError(401);
  const session = deps.getSession(token);
  if (!session) throw new AdminAuthError(401);
  if (deps.isSessionRevoked && (await safe(() => deps.isSessionRevoked!(session.token), false))) {
    throw new AdminAuthError(401, "Session revoked");
  }
  const email = normalizeEmail(session.email);
  if (isAllowlistedAdminEmail(email, deps.allowlist ?? readAdminEmailAllowlist())) {
    return { userId: session.userId, email };
  }
  const role = deps.getDbRole ? await safe(() => deps.getDbRole!(email), null) : null;
  if (role === "admin") return { userId: session.userId, email };
  throw new AdminAuthError(403);
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("[admin guard] lookup failed", error instanceof Error ? error.message : error);
    return fallback;
  }
}
