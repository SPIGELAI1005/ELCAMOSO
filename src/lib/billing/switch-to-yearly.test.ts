import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addMonthsUtc } from "@/lib/billing/black-friday";
import {
  resetEntitlementGrantsForTests,
  activeGrantedEntitlements,
} from "@/lib/entitlements/grants";
import {
  applyFoundersPackFromYearlySubscription,
  resetFoundersStoreForTests,
  revokeFoundersPackPurchase,
} from "@/lib/founders/founders.server";
import { resetFounderSoundPicksForTests } from "@/lib/founders/sound-picks.server";
import {
  canSwitchMonthlyToYearly,
  parseFoundersPackSwitchAt,
  switchMonthlySubscriptionToYearly,
} from "@/lib/billing/switch-to-yearly";
import {
  resetSubscriptionRepositoryStoreForTests,
  getSubscriptionRepository,
} from "@/lib/billing/subscription-repository-memory";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import {
  applyStripeTestEnv,
  buildStripeSubscription,
  buildYearlyStripeSubscription,
  STRIPE_TEST_CUSTOMER_ID,
  STRIPE_TEST_SUBSCRIPTION_ID,
  STRIPE_TEST_USER_ID,
} from "@/lib/billing/stripe/test-fixtures";

const subscriptionsRetrieve = vi.fn();
const subscriptionsUpdate = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    subscriptions: {
      retrieve: subscriptionsRetrieve,
      update: subscriptionsUpdate,
    },
  }),
  resetStripeClientForTests: vi.fn(),
}));

const SWITCH_AT = Date.parse("2026-11-20T12:00:00+01:00");

describe("monthly to yearly Founders Pack switch", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    resetFoundersStoreForTests();
    resetEntitlementGrantsForTests();
    resetFounderSoundPicksForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetUserBillingRepositoryForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetFoundersStoreForTests();
    resetEntitlementGrantsForTests();
    resetFounderSoundPicksForTests();
  });

  it("allows a switch only for monthly Drive+ or Drive the Music", () => {
    expect(
      canSwitchMonthlyToYearly({ plan: "DRIVE_PLUS", interval: "month", status: "active" }),
    ).toBe(true);
    expect(
      canSwitchMonthlyToYearly({ plan: "DRIVE_MUSIC", interval: "month", status: "active" }),
    ).toBe(true);
    expect(
      canSwitchMonthlyToYearly({ plan: "DRIVE_PLUS", interval: "year", status: "active" }),
    ).toBe(false);
    expect(
      canSwitchMonthlyToYearly({ plan: "DRIVE_COMPLETE", interval: "month", status: "active" }),
    ).toBe(false);
  });

  it("treats a yearly switch date in the window as a Founders Pack purchase", async () => {
    const createdAt = Date.parse("2026-10-01T12:00:00+02:00");
    const skipped = await applyFoundersPackFromYearlySubscription({
      userId: "switch-user",
      plan: "DRIVE_PLUS",
      interval: "year",
      status: "active",
      createdAt: new Date(createdAt),
    });
    expect(skipped.applied).toBe(false);
    const applied = await applyFoundersPackFromYearlySubscription(
      {
        userId: "switch-user",
        plan: "DRIVE_PLUS",
        interval: "year",
        status: "active",
        createdAt: new Date(createdAt),
      },
      SWITCH_AT,
      { purchasedAt: SWITCH_AT },
    );
    expect(applied.applied).toBe(true);
    expect(applied.until).toBe(addMonthsUtc(SWITCH_AT, 4));
  });

  it("revokes Founders Pack perks on a 14-day withdrawal, not a legacy seat", async () => {
    await applyFoundersPackFromYearlySubscription(
      {
        userId: "withdraw-user",
        plan: "DRIVE_MUSIC",
        interval: "year",
        status: "active",
        createdAt: new Date(SWITCH_AT),
      },
      SWITCH_AT,
      { purchasedAt: SWITCH_AT },
    );
    const { activeGrantedEntitlements } = await import("@/lib/entitlements/grants");
    expect(activeGrantedEntitlements("withdraw-user")).toContain("all_sound_profiles");
    await revokeFoundersPackPurchase("withdraw-user", SWITCH_AT);
    expect(activeGrantedEntitlements("withdraw-user")).not.toContain("all_sound_profiles");
  });

  it("reads foundersPackSwitchAt metadata", () => {
    expect(parseFoundersPackSwitchAt({ foundersPackSwitchAt: String(SWITCH_AT) })).toBe(SWITCH_AT);
    expect(parseFoundersPackSwitchAt({})).toBeNull();
  });

  it("updates the Stripe subscription to the yearly price with proration", async () => {
    delete process.env.DATABASE_URL;
    applyStripeTestEnv();
    resetSubscriptionRepositoryStoreForTests();
    resetUserBillingRepositoryForTests();
    await memoryUserBillingRepository.setStripeCustomerId(
      STRIPE_TEST_USER_ID,
      STRIPE_TEST_CUSTOMER_ID,
    );
    await getSubscriptionRepository().upsert({
      userId: STRIPE_TEST_USER_ID,
      provider: "stripe",
      providerCustomerId: STRIPE_TEST_CUSTOMER_ID,
      providerSubscriptionId: STRIPE_TEST_SUBSCRIPTION_ID,
      plan: "DRIVE_PLUS",
      interval: "month",
      status: "active",
      currentPeriodStart: new Date("2026-10-20T12:00:00Z"),
      currentPeriodEnd: new Date("2026-11-20T12:00:00Z"),
      cancelAtPeriodEnd: false,
    });
    const monthly = buildStripeSubscription();
    const yearly = buildYearlyStripeSubscription({
      metadata: {
        userId: STRIPE_TEST_USER_ID,
        elcamosoPlan: "DRIVE_PLUS",
        billingInterval: "year",
        foundersPackSwitchAt: String(SWITCH_AT),
      },
    });
    subscriptionsRetrieve.mockResolvedValue(monthly);
    subscriptionsUpdate.mockResolvedValue(yearly);

    const result = await switchMonthlySubscriptionToYearly(STRIPE_TEST_USER_ID, SWITCH_AT);
    expect(result.switched).toBe(true);
    expect(result.until).toBe(addMonthsUtc(SWITCH_AT, 4));
    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      STRIPE_TEST_SUBSCRIPTION_ID,
      expect.objectContaining({
        items: [{ id: "si_lifecycle", price: "price_year_test" }],
        proration_behavior: "create_prorations",
        metadata: expect.objectContaining({
          foundersPackSwitchAt: String(SWITCH_AT),
          billingInterval: "year",
        }),
      }),
    );
    expect(activeGrantedEntitlements(STRIPE_TEST_USER_ID, SWITCH_AT + 1)).toContain(
      "all_sound_profiles",
    );
  });
});
