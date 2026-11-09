import { createServerFn } from "@tanstack/react-start";

export const getBlackFridayWelcomeFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAccountSession } = await import("@/lib/account/auth-service");
  const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
  const token = tryResolveRequestSessionToken();
  const session = token ? getAccountSession(token) : null;
  if (!session) return { seen: true };
  const { hasSeenBlackFridayWelcomeServer } =
    await import("@/lib/drive-special-cap/bf-welcome.server");
  return { seen: await hasSeenBlackFridayWelcomeServer(session.userId) };
});

export const markBlackFridayWelcomeSeenFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in first");
    const { markBlackFridayWelcomeSeenServer } =
      await import("@/lib/drive-special-cap/bf-welcome.server");
    await markBlackFridayWelcomeSeenServer(session.userId, session.email ?? null);
    return { seen: true };
  });
