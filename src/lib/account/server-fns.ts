import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import {
  ACCOUNT_SESSION_COOKIE_NAME,
  GOOGLE_OAUTH_PENDING_COOKIE_NAME,
  buildAccountSessionCookieOptions,
  buildGoogleOAuthPendingCookieOptions,
  serializeClearedCookieHeader,
  serializeCookieHeader,
} from "@/lib/account/session-cookie";
import { tryResolveRequestSessionToken } from "@/lib/account/session-request";

function setSessionCookie(sessionTicket: string, expiresAt: number): void {
  setCookie(
    ACCOUNT_SESSION_COOKIE_NAME,
    sessionTicket,
    buildAccountSessionCookieOptions(expiresAt),
  );
}

function clearSessionCookie(): void {
  deleteCookie(ACCOUNT_SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: buildAccountSessionCookieOptions(Date.now() + 1000).secure,
    sameSite: "lax",
  });
}

function clearGoogleOAuthPendingCookie(): void {
  deleteCookie(GOOGLE_OAUTH_PENDING_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: buildGoogleOAuthPendingCookieOptions().secure,
    sameSite: "lax",
  });
}

export function buildSessionSetCookieHeader(sessionTicket: string, expiresAt: number): string {
  return serializeCookieHeader(
    ACCOUNT_SESSION_COOKIE_NAME,
    sessionTicket,
    buildAccountSessionCookieOptions(expiresAt),
  );
}

export function buildGoogleOAuthPendingSetCookieHeader(pendingCookie: string): string {
  return serializeCookieHeader(
    GOOGLE_OAUTH_PENDING_COOKIE_NAME,
    pendingCookie,
    buildGoogleOAuthPendingCookieOptions(),
  );
}

export function buildClearedGoogleOAuthPendingSetCookieHeader(): string {
  return serializeClearedCookieHeader(GOOGLE_OAUTH_PENDING_COOKIE_NAME);
}

export function readGoogleOAuthPendingCookie(): string | null {
  try {
    return getCookie(GOOGLE_OAUTH_PENDING_COOKIE_NAME) ?? null;
  } catch {
    return null;
  }
}

export const getAccountSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null } = {}) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    if (!token) return { authenticated: false as const };
    const session = getAccountSession(token);
    if (!session) return { authenticated: false as const };
    return {
      authenticated: true as const,
      userId: session.userId,
      email: session.email,
      expiresAt: session.expiresAt,
    };
  });

export const requestAccountSignInFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; returnTo?: string; origin: string }) => data)
  .handler(async ({ data }) => {
    const { requestAccountSignIn } = await import("@/lib/account/auth-service");
    return requestAccountSignIn(data.email, data.returnTo ?? "/drive?activateTrial=1", data.origin);
  });

export const verifyAccountMagicLinkFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { verifyAccountMagicLink } = await import("@/lib/account/auth-service");
    const verified = verifyAccountMagicLink(data.token);
    setSessionCookie(verified.sessionToken, verified.expiresAt);
    return {
      userId: verified.userId,
      email: verified.email,
      expiresAt: verified.expiresAt,
    };
  });

export const getGoogleSignInStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getGoogleSignInAvailability } = await import("@/lib/account/auth-service");
  return getGoogleSignInAvailability();
});

export const beginGoogleSignInFn = createServerFn({ method: "POST" })
  .inputValidator((data: { returnTo?: string }) => data)
  .handler(async ({ data }) => {
    const { beginGoogleSignIn } = await import("@/lib/account/auth-service");
    const started = beginGoogleSignIn(data.returnTo ?? "/drive?activateTrial=1");
    if (started.available && started.pendingCookie) {
      setCookie(
        GOOGLE_OAUTH_PENDING_COOKIE_NAME,
        started.pendingCookie,
        buildGoogleOAuthPendingCookieOptions(),
      );
    }
    // Never return pendingCookie / secrets to the browser.
    return {
      available: started.available,
      authorizeUrl: started.authorizeUrl,
      message: started.message,
    };
  });

export const completeGoogleSignInFn = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; state: string }) => data)
  .handler(async ({ data }) => {
    const { completeGoogleSignIn, toPublicGoogleSignInResult } = await import(
      "@/lib/account/auth-service"
    );
    const result = await completeGoogleSignIn(
      data.code,
      data.state,
      Date.now(),
      readGoogleOAuthPendingCookie(),
    );
    setSessionCookie(result.sessionToken, result.expiresAt);
    clearGoogleOAuthPendingCookie();
    return toPublicGoogleSignInResult(result);
  });

export const signOutAccountFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null } = {}) => data)
  .handler(async ({ data }) => {
    const { signOutAccount } = await import("@/lib/account/auth-service");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    if (token) signOutAccount(token);
    clearSessionCookie();
    return { ok: true as const };
  });
