import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setDbOverrideForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-client";

vi.mock("@/lib/founders/founders.server", () => ({
  loadFounderRecord: async (id: string) => ({ founderAt: id.endsWith("f") ? 1 : null, seat: null, testCrewOptIn: false }),
}));
vi.mock("@/lib/accounts/accounts.server", () => ({ grantSmileDrivePlus: vi.fn(async () => undefined) }));

import { saveCard } from "./cards.server";
import { applyReferral, awardCard, awardShare, getLeaderboard, getSmileStatus, redeemItem } from "./rewards.server";

const A = "11111111-1111-4111-8111-111111111111";
const F = "22222222-2222-4222-8222-22222222222f";
const card = (j: string, score = 80) => ({ journeyId: j, score, distanceKm: 5, sound: "Racing V10", country: "DE" });

describe("smile rewards ledger (PGlite)", () => {
  const prev = process.env["DATABASE_URL"];
  beforeEach(async () => {
    process.env["DATABASE_URL"] = "postgres://pglite-test/elcamoso";
    setDbOverrideForTests((await createTestDb()).db);
  });
  afterEach(() => {
    setDbOverrideForTests(null);
    if (prev === undefined) delete process.env["DATABASE_URL"];
    else process.env["DATABASE_URL"] = prev;
  });

  it("awards once per card, caps per day, founders 1.5x", async () => {
    expect((await awardCard(A, card("j1"))).awarded).toBe(80);
    expect((await awardCard(A, card("j1"))).awarded).toBe(0);
    expect((await awardCard(A, card("j2"))).awarded).toBe(70);
    expect((await awardCard(A, { ...card("j3"), distanceKm: 0.2 })).awarded).toBe(0);
    const s = await getSmileStatus(A);
    expect(s).toMatchObject({ available: true, balance: 150, earnedToday: 150 });
    expect(s.refCode).toMatch(/^[a-z0-9]{8}$/);
    expect((await awardCard(F, card("k1"))).awarded).toBe(120);
  });

  it("share bonus once a day, redeem debits, leaderboard has no emails", async () => {
    await awardCard(F, card("k1", 40));
    expect((await awardShare(F, "k1")).awarded).toBe(0); // no smiles_cards row
    expect(await redeemItem(F, "theme-midnight")).toMatchObject({ ok: false });
    const board = await getLeaderboard(F);
    expect(board.byCountry[0]?.key).toBe("DE");
    expect(board.byCountry[0]?.rows[0]).toMatchObject({ smiles: 60, me: true });
    expect(board.bySound[0]?.key).toBe("Racing V10");
  });

  it("share bonus +25% once a day, theme redeem", async () => {
    await saveCard(A, { journeyId: "s1", profileId: "v10", profileName: "Racing V10", score: 80, distanceKm: 5, result: {} as never });
    await awardCard(A, card("s1"));
    expect((await awardShare(A, "s1")).awarded).toBe(20);
    expect((await awardShare(A, "s1")).awarded).toBe(0);
    expect(await redeemItem(A, "theme-midnight")).toMatchObject({ ok: false, error: "Not enough smiles yet. Go drive!" });
  });

  it("referral credits the referrer once", async () => {
    const s = await getSmileStatus(A);
    await getSmileStatus(F);
    expect(await applyReferral(F, s.refCode!)).toBe(true);
    expect(await applyReferral(F, s.refCode!)).toBe(false);
    expect((await getSmileStatus(A)).balance).toBe(100);
  });

  it("fails soft without the database", async () => {
    delete process.env["DATABASE_URL"];
    expect((await getSmileStatus(A)).available).toBe(false);
    expect((await awardCard(A, card("x"))).awarded).toBe(0);
  });
});
