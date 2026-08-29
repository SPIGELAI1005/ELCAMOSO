import { describe, expect, it } from "vitest";

import { subscriptionRowToSubscription, userRowToUser } from "@/lib/db/mappers";
import type { SubscriptionRow, UserRow } from "@/lib/db/schema";

describe("db mappers", () => {
  it("maps user rows to domain User without card fields", () => {
    const row: UserRow = {
      id: "11111111-1111-1111-1111-111111111111",
      email: "driver@example.com",
      stripeCustomerId: "cus_test",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    expect(userRowToUser(row)).toEqual({
      id: row.id,
      email: row.email,
      stripeCustomerId: row.stripeCustomerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  });

  it("maps subscription rows to domain Subscription", () => {
    const row: SubscriptionRow = {
      id: "22222222-2222-2222-2222-222222222222",
      userId: "11111111-1111-1111-1111-111111111111",
      provider: "stripe",
      providerCustomerId: "cus_test",
      providerSubscriptionId: "sub_test",
      plan: "DRIVE_PLUS",
      interval: "month",
      status: "active",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const subscription = subscriptionRowToSubscription(row);
    expect(subscription.plan).toBe("DRIVE_PLUS");
    expect(subscription.status).toBe("active");
    expect(subscription.providerSubscriptionId).toBe("sub_test");
    expect(subscription).not.toHaveProperty("card");
    expect(subscription).not.toHaveProperty("paymentMethod");
  });
});
