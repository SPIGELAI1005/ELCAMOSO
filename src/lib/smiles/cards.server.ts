/** Server-only Smiles card storage. Every query is scoped by the verified account id. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { smilesCards } from "@/lib/db/schema";
import {
  MAX_PINNED_CARDS,
  MAX_UNPINNED_CARDS,
  type SmilesCardInput,
  type SmilesCardRecord,
} from "@/lib/smiles/cards";
import type { SmilesResult } from "@/lib/smiles/smiles";

export const hasCardsDb = () => Boolean(process.env["DATABASE_URL"]);

type Row = typeof smilesCards.$inferSelect;
const toRecord = (r: Row): SmilesCardRecord => ({
  id: r.id,
  journeyId: r.journeyId,
  profileId: r.profileId,
  profileName: r.profileName,
  score: r.score,
  distanceKm: r.distanceKm,
  result: r.result as SmilesResult,
  pinned: r.pinned,
  createdAt: r.createdAt.getTime(),
});

export async function listCards(userId: string): Promise<SmilesCardRecord[]> {
  const rows = await getDb()
    .select()
    .from(smilesCards)
    .where(eq(smilesCards.userId, userId))
    .orderBy(desc(smilesCards.createdAt))
    .limit(MAX_PINNED_CARDS + MAX_UNPINNED_CARDS + 5);
  return rows.map(toRecord);
}

export async function saveCard(userId: string, input: SmilesCardInput): Promise<void> {
  const db = getDb();
  await db
    .insert(smilesCards)
    .values({ userId, ...input, score: Math.round(input.score) })
    .onConflictDoUpdate({
      target: [smilesCards.userId, smilesCards.journeyId],
      set: {
        profileId: input.profileId,
        profileName: input.profileName,
        score: Math.round(input.score),
        distanceKm: input.distanceKm,
        result: input.result,
      },
    });
  // Rolling window: drop unpinned cards beyond the newest 10.
  const old = await db
    .select({ id: smilesCards.id })
    .from(smilesCards)
    .where(and(eq(smilesCards.userId, userId), eq(smilesCards.pinned, false)))
    .orderBy(desc(smilesCards.createdAt))
    .offset(MAX_UNPINNED_CARDS);
  if (old.length) {
    await db.delete(smilesCards).where(
      and(
        eq(smilesCards.userId, userId),
        inArray(
          smilesCards.id,
          old.map((o) => o.id),
        ),
      ),
    );
  }
}

export async function setPinned(
  userId: string,
  id: string,
  pinned: boolean,
): Promise<{ ok: boolean; full?: boolean }> {
  const db = getDb();
  if (pinned) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(smilesCards)
      .where(and(eq(smilesCards.userId, userId), eq(smilesCards.pinned, true)));
    if ((row?.n ?? 0) >= MAX_PINNED_CARDS) return { ok: false, full: true };
  }
  await db
    .update(smilesCards)
    .set({ pinned })
    .where(and(eq(smilesCards.userId, userId), eq(smilesCards.id, id)));
  return { ok: true };
}

export async function deleteCard(userId: string, id: string): Promise<void> {
  await getDb()
    .delete(smilesCards)
    .where(and(eq(smilesCards.userId, userId), eq(smilesCards.id, id)));
}
