import { useCallback, useEffect, useState } from "react";

import {
  canPin,
  loadLocalCards,
  PINNED_FULL_MESSAGE,
  pruneCards,
  saveLocalCards,
  upsertCard,
  type SmilesCardInput,
  type SmilesCardRecord,
} from "@/lib/smiles/cards";
import {
  deleteSmilesCardFn,
  listSmilesCardsFn,
  pinSmilesCardFn,
  saveSmilesCardFn,
} from "@/lib/smiles/cards-server-fns";

/** Save a card for the signed-in account, or locally for guests. Never throws. */
export async function rememberSmilesCard(
  input: SmilesCardInput,
): Promise<{ awarded: number; streak: number; total: number; level: string } | null> {
  try {
    const res = await saveSmilesCardFn({ data: input });
    if (res.cloud) {
      const s = res.smiles;
      return s && s.status.available
        ? { awarded: s.awarded, streak: s.streak, total: s.status.balance, level: s.status.level.name }
        : null;
    }
  } catch {
    /* fall back to local */
  }
  saveLocalCards(upsertCard(loadLocalCards(), input));
  return null;
}

export function useSmilesCards() {
  const [cards, setCards] = useState<SmilesCardRecord[]>([]);
  const [cloud, setCloud] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSmilesCardsFn();
      if (res.cloud) {
        setCloud(true);
        setCards(res.cards);
        return;
      }
    } catch {
      /* guest / offline */
    } finally {
      setLoading(false);
    }
    setCloud(false);
    setCards(pruneCards(loadLocalCards())[0]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const togglePin = useCallback(
    async (card: SmilesCardRecord) => {
      setNote(null);
      const pinned = !card.pinned;
      if (pinned && !canPin(cards)) {
        setNote(PINNED_FULL_MESSAGE);
        return;
      }
      if (cloud) {
        const res = await pinSmilesCardFn({ data: { id: card.id, pinned } });
        if (!res.ok) {
          setNote(PINNED_FULL_MESSAGE);
          return;
        }
        await reload();
        return;
      }
      const next = pruneCards(cards.map((c) => (c.id === card.id ? { ...c, pinned } : c)))[0];
      saveLocalCards(next);
      setCards(next);
    },
    [cards, cloud, reload],
  );

  const remove = useCallback(
    async (card: SmilesCardRecord) => {
      setNote(null);
      if (cloud) {
        await deleteSmilesCardFn({ data: { id: card.id } });
        await reload();
        return;
      }
      const next = cards.filter((c) => c.id !== card.id);
      saveLocalCards(next);
      setCards(next);
    },
    [cards, cloud, reload],
  );

  return { cards, cloud, loading, note, togglePin, remove };
}
