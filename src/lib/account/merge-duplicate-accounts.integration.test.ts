import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyMergePlan,
  buildMergePlan,
  createPgliteSqlClient,
  findDuplicateAccountGroups,
  formatMergePlan,
} from "@/lib/account/merge-duplicate-accounts";
import { createTestDb } from "@/lib/db/test-client";

const PRIMARY = "11111111-1111-4111-8111-111111111111";
const SECONDARY = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

describe("merge duplicate accounts", () => {
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let db: ReturnType<typeof createPgliteSqlClient>;

  beforeEach(async () => {
    ({ client } = await createTestDb());
    db = createPgliteSqlClient(client);
    await db.query(
      `insert into users (id, email, founder_seat, founder_at, test_crew_opt_in, smile_total)
       values
         ($1::uuid, 'george.m.neacsu@googlemail.com', 1, now(), true, 27),
         ($2::uuid, 'george.m.neacsu@gmail.com', 2, now(), false, 51),
         ($3::uuid, 'someone.else@example.com', 3, now(), false, 10)`,
      [PRIMARY, SECONDARY, OTHER],
    );
    await db.query(
      `insert into smile_ledger (user_id, amount, reason, ref)
       values
         ($1, 27, 'card', 'phone-1'),
         ($2, 51, 'card', 'tesla-1'),
         ($2, 27, 'card', 'phone-1')`,
      [PRIMARY, SECONDARY],
    );
    await db.query(
      `insert into smiles_cards (user_id, journey_id, profile_id, profile_name, score, distance_km, result)
       values
         ($1, 'phone-1', 'v10', 'Racing V10', 27, 8, '{}'::jsonb),
         ($2, 'tesla-1', 'v10', 'Racing V10', 34, 14.2, '{}'::jsonb)`,
      [PRIMARY, SECONDARY],
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("dry-run reports what would move for Founder #1 and the same Gmail person", async () => {
    const groups = await findDuplicateAccountGroups(db);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.canonicalEmail).toBe("george.m.neacsu@gmail.com");
    expect(groups[0]?.founderSeats).toEqual([1, 2]);

    const plan = await buildMergePlan(db);
    expect(plan.primary.id).toBe(PRIMARY);
    expect(plan.secondaries.map((row) => row.id)).toEqual([SECONDARY]);
    const cards = plan.moves.find((move) => move.table === "smiles_cards");
    const ledger = plan.moves.find((move) => move.table === "smile_ledger");
    expect(cards?.moved).toBe(1);
    expect(ledger?.moved).toBe(1);
    expect(ledger?.skipped).toBe(1);
    expect(plan.smileTotalAfter).toBe(78);
    expect(formatMergePlan(plan, "dry-run")).toContain("dry run");

    const afterDry = await db.query(
      `select count(*)::int as n from smiles_cards where user_id = $1`,
      [SECONDARY],
    );
    expect(Number(afterDry[0]?.n)).toBe(1);
  });

  it("apply moves rows once, clears the secondary seat, and is idempotent", async () => {
    const first = await applyMergePlan(db, await buildMergePlan(db));
    expect(first.primary.founderSeat).toBe(1);
    expect(first.secondaries[0]?.founderSeat).toBeNull();
    expect(first.smileTotalAfter).toBe(78);

    const cards = await db.query(
      `select journey_id from smiles_cards where user_id = $1 order by journey_id`,
      [PRIMARY],
    );
    expect(cards.map((row) => row["journey_id"])).toEqual(["phone-1", "tesla-1"]);
    const leftover = await db.query(
      `select count(*)::int as n from smiles_cards where user_id = $1`,
      [SECONDARY],
    );
    expect(Number(leftover[0]?.n)).toBe(0);
    const other = await db.query(`select founder_seat from users where id = $1::uuid`, [OTHER]);
    expect(Number(other[0]?.["founder_seat"])).toBe(3);

    const second = await applyMergePlan(db, await buildMergePlan(db));
    expect(second.secondaries).toHaveLength(1);
    expect(second.secondaries[0]?.founderSeat).toBeNull();
    const totals = await db.query(`select smile_total from users where id = $1::uuid`, [PRIMARY]);
    expect(Number(totals[0]?.["smile_total"])).toBe(78);
  });
});
