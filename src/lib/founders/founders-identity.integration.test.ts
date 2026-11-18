import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setDbOverrideForTests } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-client";
import {
  claimFounderSeat,
  claimFounderSeatFromPurchase,
  resetFoundersStoreForTests,
} from "@/lib/founders/founders.server";

const ONE = "11111111-1111-4111-8111-111111111111";
const TWO = "22222222-2222-4222-8222-222222222222";
const ENV: Record<string, string> = {
  DATABASE_URL: "postgres://pglite-test/elcamoso",
  FOUNDER_SEAT_LIMIT: "458",
};
const previous: Record<string, string | undefined> = {};

const beforeCutover = Date.parse("2026-11-01T12:00:00+01:00");
const duringBf = Date.parse("2026-11-20T12:00:00+01:00");

describe("founder seat reuse for Gmail aliases", () => {
  let db: TestDb;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => {
    for (const [k, v] of Object.entries(ENV)) {
      previous[k] = process.env[k];
      process.env[k] = v;
    }
    ({ db, client } = await createTestDb());
    setDbOverrideForTests(db);
    resetFoundersStoreForTests();
  });

  afterEach(async () => {
    setDbOverrideForTests(null);
    resetFoundersStoreForTests();
    for (const k of Object.keys(ENV)) {
      if (previous[k] === undefined) delete process.env[k];
      else process.env[k] = previous[k];
    }
    await client.close();
  });

  it("reuses an existing seat and never grants a second one for the same person", async () => {
    const first = await claimFounderSeat(ONE, "george.m.neacsu@googlemail.com", beforeCutover);
    expect(first.seat).toBe(1);
    const second = await claimFounderSeat(TWO, "george.m.neacsu@gmail.com", beforeCutover);
    expect(second.founderAt).toBeNull();
    expect(second.seat).toBeNull();
    const again = await claimFounderSeat(ONE, "george.m.neacsu@gmail.com", beforeCutover);
    expect(again.seat).toBe(1);
    const seated = await db.select().from(users);
    const seats = seated.map((row) => row.founderSeat).filter((seat) => seat != null);
    expect(seats).toEqual([1]);
  });

  it("does not mint a second seat from a paid purchase either", async () => {
    const first = await claimFounderSeat(ONE, "george.m.neacsu@googlemail.com", beforeCutover);
    expect(first.seat).toBe(1);
    const paid = await claimFounderSeatFromPurchase(TWO, "george.m.neacsu@gmail.com", duringBf);
    expect(paid.founderAt).toBeNull();
    expect(paid.seat).toBeNull();
  });
});
