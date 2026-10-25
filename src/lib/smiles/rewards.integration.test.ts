import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";

import * as accounts from "@/lib/accounts/accounts.server";
import { getDb, setDbOverrideForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-client";

vi.mock("@/lib/founders/founders.server", () => ({
  loadFounderRecord: async (id: string) => ({ founderAt: id.endsWith("f") ? 1 : null, seat: null, testCrewOptIn: false }),
}));
vi.mock("@/lib/accounts/accounts.server", () => ({ grantSmileDrivePlus: vi.fn(async () => undefined) }));

import { saveCard } from "./cards.server";
import { applyReferral, awardCard, qualifyReferral, awardShare, getLeaderboard, getSmileStatus, redeemItem } from "./rewards.server";

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

  const friend = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
  const confirm = (id: string) =>
    getDb().execute(sql`update users set email = ${id + "@example.test"} where id = ${id}::uuid`);
  const grants = () => vi.mocked(accounts.grantSmileDrivePlus).mock.calls.map((c) => c[0]);

  it("invite Drive+ needs a confirmed email and a real drive, both get it once", async () => {
    vi.mocked(accounts.grantSmileDrivePlus).mockClear();
    const code = (await getSmileStatus(A)).refCode!;
    const B = friend(1);
    await getSmileStatus(B);
    expect(await applyReferral(B, code)).toBe(true);
    expect(grants()).toEqual([]); // no drive, no email yet
    await awardCard(B, { ...card("b1"), durationMs: 30_000 }); // too short (< 1 min)
    await awardCard(B, { ...card("b2"), distanceKm: 0.5 }); // too short (< 1 km)
    await confirm(B);
    expect(await qualifyReferral(B)).toBeNull();
    await awardCard(B, { ...card("b3"), durationMs: 120_000 });
    expect(grants().sort()).toEqual([A, B].sort());
    expect(await qualifyReferral(B)).toBeNull(); // idempotent
    await awardCard(B, card("b4"));
    expect(grants()).toHaveLength(2);
    const [a, b] = [await getSmileStatus(A), await getSmileStatus(B)];
    expect(a).toMatchObject({ balance: 100, inviteMonths: 1, inviteReward: { role: "inviter" } });
    expect(b.inviteReward?.role).toBe("friend");
  });

  it("no self-referral and no referring existing accounts", async () => {
    const code = (await getSmileStatus(A)).refCode!;
    expect(await applyReferral(A, code)).toBe(false);
    const Old = friend(99);
    await getSmileStatus(Old);
    await getDb().execute(sql`update users set created_at = now() - interval '4 days' where id = ${Old}::uuid`);
    expect(await applyReferral(Old, code)).toBe(false);
  });

  it("caps the inviter at 6 months; friends always get theirs; smiles keep coming", async () => {
    vi.mocked(accounts.grantSmileDrivePlus).mockClear();
    const code = (await getSmileStatus(A)).refCode!;
    for (let n = 1; n <= 7; n++) {
      const B = friend(n);
      await getSmileStatus(B);
      await confirm(B);
      expect(await applyReferral(B, code)).toBe(true);
      await awardCard(B, { ...card(`c${n}`), durationMs: 90_000 });
    }
    const g = grants();
    expect(g.filter((id) => id === A)).toHaveLength(6);
    for (let n = 1; n <= 7; n++) expect(g).toContain(friend(n));
    const s = await getSmileStatus(A);
    expect(s).toMatchObject({ balance: 700, inviteMonths: 6, inviteReward: { role: "inviter-capped" } });
  });

  it("fails soft without the database", async () => {
    delete process.env["DATABASE_URL"];
    expect((await getSmileStatus(A)).available).toBe(false);
    expect((await awardCard(A, card("x"))).awarded).toBe(0);
  });
});
