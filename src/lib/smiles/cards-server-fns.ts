import { createServerFn } from "@tanstack/react-start";

import type { SmilesCardInput } from "@/lib/smiles/cards";

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function currentUserId(): Promise<string | null> {
  const { getAccountSession } = await import("@/lib/account/auth-service");
  const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
  const token = tryResolveRequestSessionToken(null);
  return token ? (getAccountSession(token)?.userId ?? null) : null;
}

async function requireUser(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error("Authentication required");
  return id;
}

/** `cloud: false` means guest or no DB: the client uses localStorage. */
export const listSmilesCardsFn = createServerFn({ method: "POST" }).handler(async () => {
  const { hasCardsDb, listCards } = await import("./cards.server");
  const userId = await currentUserId();
  if (!userId || !hasCardsDb()) return { cloud: false as const, cards: [] };
  return { cloud: true as const, cards: await listCards(userId) };
});

export const saveSmilesCardFn = createServerFn({ method: "POST" })
  .inputValidator((data: SmilesCardInput) => {
    if (typeof data.journeyId !== "string" || data.journeyId.length > 120)
      throw new Error("Bad card");
    if (typeof data.profileId !== "string" || data.profileId.length > 80)
      throw new Error("Bad card");
    if (JSON.stringify(data.result ?? {}).length > 8000) throw new Error("Bad card");
    return {
      journeyId: data.journeyId,
      profileId: data.profileId,
      profileName: String(data.profileName).slice(0, 80),
      score: Math.max(0, Math.min(100, Number(data.score) || 0)),
      distanceKm: Math.max(0, Number(data.distanceKm) || 0),
      result: data.result,
    };
  })
  .handler(async ({ data }) => {
    const { hasCardsDb, saveCard } = await import("./cards.server");
    const userId = await currentUserId();
    if (!userId || !hasCardsDb()) return { cloud: false };
    await saveCard(userId, data);
    return { cloud: true };
  });

export const pinSmilesCardFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; pinned: boolean }) => {
    if (!UUID_RE.test(data.id)) throw new Error("Bad id");
    return { id: data.id, pinned: Boolean(data.pinned) };
  })
  .handler(async ({ data }) => {
    const { setPinned } = await import("./cards.server");
    return setPinned(await requireUser(), data.id, data.pinned);
  });

export const deleteSmilesCardFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => {
    if (!UUID_RE.test(data.id)) throw new Error("Bad id");
    return data;
  })
  .handler(async ({ data }) => {
    const { deleteCard } = await import("./cards.server");
    await deleteCard(await requireUser(), data.id);
    return { ok: true };
  });
