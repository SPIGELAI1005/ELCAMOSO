import { createServerFn } from "@tanstack/react-start";

import { emptySmileStatus, HANDLE_RE, REF_CODE_RE } from "@/lib/smiles/rewards";

async function currentUserId(): Promise<string | null> {
  const { getAccountSession } = await import("@/lib/account/auth-service");
  const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
  const token = tryResolveRequestSessionToken(null);
  return token ? (getAccountSession(token)?.userId ?? null) : null;
}

export const getSmileStatusFn = createServerFn({ method: "POST" }).handler(async () => {
  const userId = await currentUserId();
  if (!userId) return emptySmileStatus();
  const { getSmileStatus } = await import("./rewards.server");
  return getSmileStatus(userId);
});

export const shareSmilesBonusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { journeyId: string }) => {
    if (typeof data.journeyId !== "string" || data.journeyId.length > 120) throw new Error("Bad card");
    return { journeyId: data.journeyId };
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    if (!userId) return { awarded: 0 };
    const { awardShare } = await import("./rewards.server");
    return { awarded: (await awardShare(userId, data.journeyId)).awarded };
  });

export const applySmileReferralFn = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => {
    if (!REF_CODE_RE.test(String(data.code))) throw new Error("Bad code");
    return { code: String(data.code) };
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    if (!userId) return { ok: false };
    const { applyReferral } = await import("./rewards.server");
    return { ok: await applyReferral(userId, data.code) };
  });

export const redeemSmileItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string }) => ({ itemId: String(data.itemId).slice(0, 40) }))
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    if (!userId) return { ok: false as const, error: "Sign in to spend smiles." };
    const { redeemItem } = await import("./rewards.server");
    return redeemItem(userId, data.itemId);
  });

export const setSmileHandleFn = createServerFn({ method: "POST" })
  .inputValidator((data: { handle: string }) => {
    const h = String(data.handle ?? "").trim();
    if (h && !HANDLE_RE.test(h)) throw new Error("3-20 letters, numbers, . _ -");
    return { handle: h || null };
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    if (!userId) return { ok: false };
    const { setSmileHandle } = await import("./rewards.server");
    return { ok: await setSmileHandle(userId, data.handle) };
  });

export const getSmileLeaderboardFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getLeaderboard } = await import("./rewards.server");
  return getLeaderboard(await currentUserId());
});
