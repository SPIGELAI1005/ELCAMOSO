import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { subscriptions, users } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-client";

describe("subscriptions unique constraints", () => {
  let db: TestDb;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
  });

  afterEach(async () => {
    await client.close();
  });

  it("rejects duplicate provider subscription ids", async () => {
    const userId = randomUUID();
    const providerSubscriptionId = `sub_${randomUUID()}`;

    await db.insert(users).values({ id: userId, email: `${userId}@example.com` });

    await db.insert(subscriptions).values({
      userId,
      provider: "stripe",
      providerCustomerId: "cus_a",
      providerSubscriptionId,
      plan: "DRIVE_PLUS",
      interval: "month",
      status: "active",
    });

    await expect(
      db.insert(subscriptions).values({
        userId,
        provider: "stripe",
        providerCustomerId: "cus_b",
        providerSubscriptionId,
        plan: "DRIVE_PLUS",
        interval: "year",
        status: "trialing",
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate stripe customer ids on users", async () => {
    const stripeCustomerId = `cus_${randomUUID()}`;
    const userA = randomUUID();
    const userB = randomUUID();

    await db.insert(users).values({ id: userA, stripeCustomerId });
    await expect(db.insert(users).values({ id: userB, stripeCustomerId })).rejects.toThrow();
  });

  it("stores subscription billing fields without card data columns", async () => {
    const userId = randomUUID();
    await db.insert(users).values({ id: userId });

    const [row] = await db
      .insert(subscriptions)
      .values({
        userId,
        provider: "stripe",
        providerCustomerId: "cus_x",
        providerSubscriptionId: `sub_${randomUUID()}`,
        plan: "DRIVE_PLUS",
        interval: "year",
        status: "trialing",
        cancelAtPeriodEnd: true,
      })
      .returning();

    expect(row?.status).toBe("trialing");
    expect(row?.interval).toBe("year");
    expect(row).not.toHaveProperty("cardLast4");
    expect(row).not.toHaveProperty("paymentMethodId");
  });
});

describe("users table", () => {
  let db: TestDb;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
  });

  afterEach(async () => {
    await client.close();
  });

  it("persists stripeCustomerId on user", async () => {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: "driver@example.com",
      stripeCustomerId: "cus_linked",
    });

    const [row] = await db.select().from(users).where(eq(users.id, id));
    expect(row?.stripeCustomerId).toBe("cus_linked");
  });
});
