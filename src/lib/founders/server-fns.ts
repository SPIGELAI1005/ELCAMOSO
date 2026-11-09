import { createServerFn } from "@tanstack/react-start";

/** Public Founders seat counter (cached ~30 s server-side). */
export const getFoundersSeatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getFounderSeatsTaken } = await import("@/lib/founders/founders.server");
  const { founderSeatLimit } = await import("@/lib/founders/founders");
  const taken = await getFounderSeatsTaken();
  const limit = founderSeatLimit();
  return { taken, limit, left: Math.max(0, limit - taken) };
});

/** Founders-only: current forever-sound picks. */
export const getFounderSoundPicksFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getAccountSession } = await import("@/lib/account/auth-service");
  const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
  const token = tryResolveRequestSessionToken();
  const session = token ? getAccountSession(token) : null;
  if (!session) throw new Error("Sign in first");
  const { founderPicksSnapshot } = await import("@/lib/founders/sound-picks.server");
  return founderPicksSnapshot(session.userId);
});

/** Founders-only: save a draft of forever-sound picks (not locked until confirm). */
export const saveFounderSoundPicksFn = createServerFn({ method: "POST" })
  .inputValidator((data: { soundIds: string[]; sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in first");
    const { loadFounderRecord } = await import("@/lib/founders/founders.server");
    const rec = await loadFounderRecord(session.userId);
    if (rec.founderAt == null) throw new Error("Founders Pack buyers can pick 4 forever sounds");
    const { isLegacyFounderClaim } = await import("@/lib/founders/founders");
    if (isLegacyFounderClaim(rec.founderAt)) {
      throw new Error("Existing Founders keep Racing V10, American Muscle V8 and GT V8 forever");
    }
    const { saveFounderSoundPicks, founderPicksSnapshot } =
      await import("@/lib/founders/sound-picks.server");
    await saveFounderSoundPicks(session.userId, data.soundIds ?? []);
    return founderPicksSnapshot(session.userId);
  });

/** Founders-only: lock the current 4 forever-sound picks. */
export const confirmFounderSoundPicksFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { getAccountSession } = await import("@/lib/account/auth-service");
    const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
    const token = tryResolveRequestSessionToken(data.sessionToken);
    const session = token ? getAccountSession(token) : null;
    if (!session) throw new Error("Sign in first");
    const { loadFounderRecord } = await import("@/lib/founders/founders.server");
    const rec = await loadFounderRecord(session.userId);
    if (rec.founderAt == null) throw new Error("Founders Pack buyers can pick 4 forever sounds");
    const { isLegacyFounderClaim } = await import("@/lib/founders/founders");
    if (isLegacyFounderClaim(rec.founderAt)) {
      throw new Error("Existing Founders keep Racing V10, American Muscle V8 and GT V8 forever");
    }
    const { confirmFounderSoundPicks, founderPicksSnapshot } =
      await import("@/lib/founders/sound-picks.server");
    await confirmFounderSoundPicks(session.userId);
    const { persistEntitlementGrantsForAccount } =
      await import("@/lib/billing/durable-state.server");
    await persistEntitlementGrantsForAccount(session.userId).catch(() => undefined);
    return founderPicksSnapshot(session.userId);
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
