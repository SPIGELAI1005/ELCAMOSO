import { beforeEach, describe, expect, it } from "vitest";

import { provisionEntitlementsFromSubscription } from "@/lib/billing/provision-entitlements";
import {
  getSubscriptionForUser,
  resetSubscriptionStoreForTests,
} from "@/lib/billing/subscription-store";
import type { Subscription } from "@/lib/billing/types";
import {
  beginLiveDriveAccess,
  endLiveDriveAccess,
  hasEntitlementDuringLiveDriveHold,
  resetLiveDriveAccessForTests,
} from "@/lib/entitlements/live-drive-access";
import { PREMIUM_ENTITLEMENTS } from "@/lib/entitlements/plans";

const USER_ID = "44444444-4444-4444-8444-444444444444";

function baseSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-local-1",
    userId: USER_ID,
    provider: "stripe",
    providerCustomerId: "cus_test",
    providerSubscriptionId: "sub_test",
    plan: "DRIVE_PLUS",
    interval: "month",
    status: "active",
    currentPeriodStart: new Date("2026-01-01"),
    currentPeriodEnd: new Date("2026-02-01"),
    cancelAtPeriodEnd: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("live drive access hold", () => {
  beforeEach(() => {
    resetLiveDriveAccessForTests();
  });

  it("preserves committed premium entitlements until Drive ends", () => {
    beginLiveDriveAccess(PREMIUM_ENTITLEMENTS);
    expect(hasEntitlementDuringLiveDriveHold("dynamic_drive")).toBe(true);
    expect(hasEntitlementDuringLiveDriveHold("all_sound_profiles")).toBe(true);
    endLiveDriveAccess();
    expect(hasEntitlementDuringLiveDriveHold("dynamic_drive")).toBe(false);
  });
});

describe("provision entitlements with access policy", () => {
  beforeEach(() => {
    resetLiveDriveAccessForTests();
    resetSubscriptionStoreForTests();
  });

  it("retains Drive+ during past_due grace in the runtime store", () => {
    provisionEntitlementsFromSubscription(
      baseSubscription({ status: "past_due", updatedAt: new Date() }),
    );
    expect(getSubscriptionForUser(USER_ID)).toMatchObject({
      plan: "DRIVE_PLUS",
      status: "past_due",
    });
    expect(getSubscriptionForUser(USER_ID)?.pastDueSince).toBeInstanceOf(Date);
  });

  it("downgrades to FREE when canceled and period ended", () => {
    provisionEntitlementsFromSubscription(
      baseSubscription({
        status: "canceled",
        currentPeriodEnd: new Date("2020-01-01"),
      }),
    );
    expect(getSubscriptionForUser(USER_ID)).toMatchObject({
      plan: "FREE",
      status: "free",
    });
  });
});
