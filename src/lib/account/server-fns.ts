import { createServerFn } from "@tanstack/react-start";

export const getAccountSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null } = {}) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
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
    const { setAccountSessionCookie } = await import("@/lib/account/session-cookies.server");
    const verified = verifyAccountMagicLink(data.token);
    setAccountSessionCookie(verified.sessionToken, verified.expiresAt);
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
    const { setGoogleOAuthPendingCookie } = await import("@/lib/account/session-cookies.server");
    const started = beginGoogleSignIn(data.returnTo ?? "/drive?activateTrial=1");
    if (started.available && started.pendingCookie) {
      setGoogleOAuthPendingCookie(started.pendingCookie);
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
    const { completeGoogleSignIn, toPublicGoogleSignInResult } =
      await import("@/lib/account/auth-service");
    const { readGoogleOAuthPendingCookie, setAccountSessionCookie, clearGoogleOAuthPendingCookie } =
      await import("@/lib/account/session-cookies.server");
    const result = await completeGoogleSignIn(
      data.code,
      data.state,
      Date.now(),
      readGoogleOAuthPendingCookie(),
    );
    setAccountSessionCookie(result.sessionToken, result.expiresAt);
    clearGoogleOAuthPendingCookie();
    return toPublicGoogleSignInResult(result);
  });

export const signOutAccountFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null } = {}) => data)
  .handler(async ({ data }) => {
    const { signOutAccount } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken, clearAccountSessionCookie } =
      await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    if (token) signOutAccount(token);
    clearAccountSessionCookie();
    return { ok: true as const };
  });
