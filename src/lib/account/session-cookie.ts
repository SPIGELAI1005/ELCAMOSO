import { ACCOUNT_SESSION_TTL_MS } from "@/lib/account/session-store";

/** HttpOnly cookie holding the ELCAMOSO account session token. */
export const ACCOUNT_SESSION_COOKIE_NAME = "elcamoso_account_session";

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
