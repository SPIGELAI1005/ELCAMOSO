import { createServerFn } from "@tanstack/react-start";

export const getAccountSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const session = getAccountSession(data.sessionToken);
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
    return verifyAccountMagicLink(data.token);
  });

export const signOutAccountFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string }) => data)
  .handler(async ({ data }) => {
    const { signOutAccount } = await import("@/lib/account/auth-service");
    signOutAccount(data.sessionToken);
    return { ok: true as const };
  });
