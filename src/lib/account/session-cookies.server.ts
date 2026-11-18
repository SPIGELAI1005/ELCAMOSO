/**
 * Server-only account cookie helpers.
 * Do not import this module from client code - only from createServerFn handlers
 * (dynamic import) or server route handlers.
 */
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

import {
  ACCOUNT_SESSION_COOKIE_NAME,
  GOOGLE_OAUTH_PENDING_COOKIE_NAME,
  buildAccountSessionCookieOptions,
  buildGoogleOAuthPendingCookieOptions,
  sessionCookieDomainForHost,
} from "@/lib/account/session-cookie";

export function currentRequestHost(): string | null {
  try {
    const forwarded = getRequestHeader("x-forwarded-host");
    const host = getRequestHeader("host");
    const raw = (forwarded || host || "").split(",")[0]?.trim() ?? "";
    return raw || null;
  } catch {
    return null;
  }
}

export function tryResolveRequestSessionToken(explicit?: string | null): string | null {
  const fromExplicit = explicit?.trim();
  if (fromExplicit) return fromExplicit;
  try {
    const fromCookie = getCookie(ACCOUNT_SESSION_COOKIE_NAME)?.trim();
    if (fromCookie) return fromCookie;
  } catch {
    // Outside a request context (unit tests), cookie APIs are unavailable.
  }
  return null;
}

export function resolveRequestSessionToken(explicit?: string | null): string {
  const token = tryResolveRequestSessionToken(explicit);
  if (!token) throw new Error("Authentication required");
  return token;
}

export function setAccountSessionCookie(sessionTicket: string, expiresAt: number): void {
  const host = currentRequestHost();
  setCookie(
    ACCOUNT_SESSION_COOKIE_NAME,
    sessionTicket,
    buildAccountSessionCookieOptions(expiresAt, Date.now(), { host }),
  );
}

export function clearAccountSessionCookie(): void {
  const host = currentRequestHost();
  const secure = buildAccountSessionCookieOptions(Date.now() + 1000, Date.now(), { host }).secure;
  const base = { path: "/", httpOnly: true as const, secure, sameSite: "lax" as const };
  deleteCookie(ACCOUNT_SESSION_COOKIE_NAME, base);
  const domain = sessionCookieDomainForHost(host);
  // Also drop a shared-domain cookie (and a leftover host-only cookie) on the live site.
  if (domain) {
    deleteCookie(ACCOUNT_SESSION_COOKIE_NAME, { ...base, domain });
  }
}

export function setGoogleOAuthPendingCookie(pendingCookie: string): void {
  setCookie(
    GOOGLE_OAUTH_PENDING_COOKIE_NAME,
    pendingCookie,
    buildGoogleOAuthPendingCookieOptions({ host: currentRequestHost() }),
  );
}

export function readGoogleOAuthPendingCookie(): string | null {
  try {
    return getCookie(GOOGLE_OAUTH_PENDING_COOKIE_NAME) ?? null;
  } catch {
    return null;
  }
}

export function clearGoogleOAuthPendingCookie(): void {
  const host = currentRequestHost();
  const secure = buildGoogleOAuthPendingCookieOptions({ host }).secure;
  const base = { path: "/", httpOnly: true as const, secure, sameSite: "lax" as const };
  deleteCookie(GOOGLE_OAUTH_PENDING_COOKIE_NAME, base);
  const domain = sessionCookieDomainForHost(host);
  if (domain) {
    deleteCookie(GOOGLE_OAUTH_PENDING_COOKIE_NAME, { ...base, domain });
  }
}
