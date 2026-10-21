import { describe, expect, it } from "vitest";
import { MAX_PINNED_CARDS, canPin, pruneCards, upsertCard, type SmilesCardRecord } from "./cards";

const input = (j: string) => ({
  journeyId: j,
  profileId: "racing-v10",
  profileName: "Racing V10",
  score: 50,
  distanceKm: 5,
  result: {} as SmilesCardRecord["result"],
});

describe("smiles cards", () => {
  it("keeps the newest 10 unpinned and all pinned", () => {
    let cards: SmilesCardRecord[] = [];
    cards = upsertCard(cards, input("pin"), 1, "pin");
    cards = cards.map((c) => ({ ...c, pinned: true }));
    for (let i = 0; i < 11; i++) cards = upsertCard(cards, input(`j${i}`), 10 + i, `id${i}`);
    expect(cards).toHaveLength(11);
    expect(cards.some((c) => c.id === "id0")).toBe(false);
    expect(cards.some((c) => c.id === "pin")).toBe(true);
  });
  it("upserts by journey and caps pins", () => {
    let cards = upsertCard([], input("a"), 1, "a");
    cards = upsertCard(cards, { ...input("a"), score: 90 }, 2);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.score).toBe(90);
    const many = Array.from({ length: MAX_PINNED_CARDS }, (_, i) => ({
      ...cards[0]!,
      id: `p${i}`,
      pinned: true,
    }));
    expect(canPin(many)).toBe(false);
    expect(pruneCards(many)[1]).toHaveLength(0);
  });
});
