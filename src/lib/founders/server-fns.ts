import { createServerFn } from "@tanstack/react-start";

/** Public Founders seat counter (cached ~30 s server-side). */
export const getFoundersSeatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getFounderSeatsTaken } = await import("@/lib/founders/founders.server");
  const { founderSeatLimit } = await import("@/lib/founders/founders");
  const taken = await getFounderSeatsTaken();
  const limit = founderSeatLimit();
  return { taken, limit, left: Math.max(0, limit - taken) };
});

/** Founders-only: opt in / out of the Founders Test Crew (early access + beta feedback). */
export const setTestCrewOptInFn = createServerFn({ method: "POST" })
  .inputValidator((data: { optIn: boolean; sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in first");
    const { setTestCrewOptIn } = await import("@/lib/founders/founders.server");
    const rec = await setTestCrewOptIn(session.userId, Boolean(data.optIn));
    return { testCrewOptIn: rec.testCrewOptIn };
  });
