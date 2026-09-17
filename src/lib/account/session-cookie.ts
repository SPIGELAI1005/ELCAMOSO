import { ACCOUNT_SESSION_TTL_MS } from "@/lib/account/session-store";

/** HttpOnly cookie holding the ELCAMOSO account session ticket. */
export const ACCOUNT_SESSION_COOKIE_NAME = "elcamoso_account_session";

/** Short-lived cookie for Google OAuth PKCE / state / nonce (CSRF + multi-instance safe). */
export const GOOGLE_OAUTH_PENDING_COOKIE_NAME = "elcamoso_google_oauth";

export interface AccountSessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

export function isProductionRuntime(): boolean {
  const tier = (process.env["ELCAMOSO_ENV"] ?? process.env["NODE_ENV"] ?? "development").toLowerCase();
  return tier === "production";
}

/**
 * Cookie attributes for the account session.
 * Secure is always on in production; SameSite=Lax for OAuth top-level redirects.
 */
export function buildAccountSessionCookieOptions(
  expiresAt: number,
  now = Date.now(),
  opts?: { production?: boolean },
): AccountSessionCookieOptions {
  const maxAgeMs = Math.max(0, expiresAt - now);
  const maxAge = Math.floor(maxAgeMs / 1000) || Math.floor(ACCOUNT_SESSION_TTL_MS / 1000);
  const production = opts?.production ?? isProductionRuntime();
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function buildGoogleOAuthPendingCookieOptions(opts?: {
  production?: boolean;
}): AccountSessionCookieOptions {
  const production = opts?.production ?? isProductionRuntime();
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  };
}

/** Serialize a Set-Cookie header value (no dependency on returning via h3 event). */
export function serializeCookieHeader(
  name: string,
  value: string,
  options: AccountSessionCookieOptions,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${Math.max(0, options.maxAge)}`,
    "HttpOnly",
    `SameSite=${options.sameSite === "lax" ? "Lax" : options.sameSite}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function serializeClearedCookieHeader(
  name: string,
  opts?: { production?: boolean },
): string {
  return serializeCookieHeader(name, "", {
    ...buildAccountSessionCookieOptions(Date.now() + 1000, Date.now(), opts),
    maxAge: 0,
  });
}
