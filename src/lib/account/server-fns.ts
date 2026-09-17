import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, setCookie } from "@tanstack/react-start/server";

import {
  ACCOUNT_SESSION_COOKIE_NAME,
  buildAccountSessionCookieOptions,
} from "@/lib/account/session-cookie";
import { tryResolveRequestSessionToken } from "@/lib/account/session-request";

function setSessionCookie(sessionToken: string, expiresAt: number): void {
  setCookie(
    ACCOUNT_SESSION_COOKIE_NAME,
    sessionToken,
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

export const getAccountSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
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
    // Do not return sessionToken to the browser — cookie is the session carrier.
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
    return beginGoogleSignIn(data.returnTo ?? "/drive?activateTrial=1");
  });

export const completeGoogleSignInFn = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; state: string }) => data)
  .handler(async ({ data }) => {
    const { completeGoogleSignIn, toPublicGoogleSignInResult } = await import(
      "@/lib/account/auth-service"
    );
    const result = await completeGoogleSignIn(data.code, data.state);
    setSessionCookie(result.sessionToken, result.expiresAt);
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
