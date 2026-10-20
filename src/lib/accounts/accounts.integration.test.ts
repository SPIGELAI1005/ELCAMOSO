import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  activeGrantedEntitlements,
  activeGrantedProfileIds,
  resetEntitlementGrantsForTests,
} from "@/lib/entitlements/grants";
import { hydrateUserBillingState } from "@/lib/billing/durable-state.server";
import { setDbOverrideForTests } from "@/lib/db/client";
import { createTestDb } from "@/lib/db/test-client";

import {
  adminGrantDrivePlus,
  adminGrantSound,
  adminRemoveSound,
  adminUpsertPromo,
  getUserDetail,
  linkDevice,
  redeemPromo,
  searchUsers,
} from "./accounts.server";

const admin = { userId: "admin", email: "admin@example.com" } as never;
const U = "11111111-1111-4111-8111-111111111111";

describe("accounts admin + promos (PGlite)", () => {
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  beforeEach(async () => {
    process.env["DATABASE_URL"] = "postgres://test";
    const t = await createTestDb();
    client = t.client;
    setDbOverrideForTests(t.db);
    resetEntitlementGrantsForTests();
    await t.db.execute(`insert into users (id, email) values ('${U}', 'driver@example.com')` as never);
  });
  afterEach(async () => {
    setDbOverrideForTests(null);
    delete process.env["DATABASE_URL"];
    await client.close();
  });

  it("grants and removes sounds, visible to the entitlement pipeline", async () => {
    expect((await searchUsers("driver"))[0]?.id).toBe(U);
    await adminGrantSound(admin, U, "v8-muscle", null);
    await hydrateUserBillingState(U, { force: true });
    expect(activeGrantedProfileIds(U)).toContain("v8-muscle");
    await adminRemoveSound(admin, U, "v8-muscle");
    await hydrateUserBillingState(U, { force: true });
    expect(activeGrantedProfileIds(U)).not.toContain("v8-muscle");
  });

  it("Drive+ grant expires", async () => {
    await adminGrantDrivePlus(admin, U, 7);
    await hydrateUserBillingState(U, { force: true });
    expect(activeGrantedEntitlements(U).length).toBeGreaterThan(3);
    expect(activeGrantedEntitlements(U, Date.now() + 8 * 86400_000)).toHaveLength(0);
  });

  it("promo codes redeem once and respect limits; devices link", async () => {
    await adminUpsertPromo(admin, { code: "launch", profileIds: ["flat-six"], drivePlusDays: 14, maxRedemptions: 1 });
    const r = await redeemPromo(U, "LAUNCH");
    expect(r.profileIds).toEqual(["flat-six"]);
    await expect(redeemPromo(U, "LAUNCH")).rejects.toThrow(/already|fully/);
    await expect(redeemPromo(U, "NOPE")).rejects.toThrow(/Unknown/);
    expect(await linkDevice(U, "elc-abcd1234")).toBe(true);
    const d = await getUserDetail(U);
    expect(d.devices[0]?.installId).toBe("elc-abcd1234");
    expect(d.promos).toEqual(["LAUNCH"]);
    expect(d.grants.some((g) => g.kind === "promo_profile")).toBe(true);
  });
});
