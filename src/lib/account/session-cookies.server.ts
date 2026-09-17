/**
 * Server-only account cookie helpers.
 * Do not import this module from client code — only from createServerFn handlers
 * (dynamic import) or server route handlers.
 */
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import {
  ACCOUNT_SESSION_COOKIE_NAME,
  GOOGLE_OAUTH_PENDING_COOKIE_NAME,
  buildAccountSessionCookieOptions,
  buildGoogleOAuthPendingCookieOptions,
} from "@/lib/account/session-cookie";

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
  setCookie(
    ACCOUNT_SESSION_COOKIE_NAME,
    sessionTicket,
    buildAccountSessionCookieOptions(expiresAt),
  );
}

export function clearAccountSessionCookie(): void {
  deleteCookie(ACCOUNT_SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: buildAccountSessionCookieOptions(Date.now() + 1000).secure,
    sameSite: "lax",
  });
}

export function setGoogleOAuthPendingCookie(pendingCookie: string): void {
  setCookie(
    GOOGLE_OAUTH_PENDING_COOKIE_NAME,
    pendingCookie,
    buildGoogleOAuthPendingCookieOptions(),
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
  deleteCookie(GOOGLE_OAUTH_PENDING_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: buildGoogleOAuthPendingCookieOptions().secure,
    sameSite: "lax",
  });
}
