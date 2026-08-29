import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { syncStripeSubscriptionRecord } from "@/lib/billing/stripe/subscription-sync";
import {
  assertLocalEntitlements,
  STRIPE_TEST_USER_ID,
} from "@/lib/billing/stripe/test-fixtures";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import { resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import { isStripeConfigured, readStripeConfig } from "@/lib/billing/stripe/config";
import { getStripeClient, resetStripeClientForTests } from "@/lib/billing/stripe/client";

const canRunLiveStripe =
  process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true &&
  Boolean(process.env.STRIPE_WEBHOOK_SECRET) &&
  Boolean(process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY) &&
  Boolean(process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY);

const canRunTestClock =
  canRunLiveStripe && process.env.STRIPE_LIFECYCLE_TEST_CLOCK === "1";

const live = canRunLiveStripe ? describe : describe.skip;
const testClockSuite = canRunTestClock ? describe : describe.skip;

live("stripe lifecycle integration (test mode API)", () => {
  beforeAll(() => {
    resetUserBillingRepositoryForTests();
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetStripeClientForTests();
    expect(isStripeConfigured()).toBe(true);
  });

  it("Stripe test-mode config exposes mapped monthly and yearly prices", () => {
    const config = readStripeConfig();
    expect(config.prices.drive_plus_monthly.startsWith("price_")).toBe(true);
    expect(config.prices.drive_plus_yearly.startsWith("price_")).toBe(true);
  });
});

testClockSuite("stripe test clock lifecycle (optional live)", () => {
  let stripe: Stripe;
  let testClockId: string;
  let customerId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    resetUserBillingRepositoryForTests();
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetStripeClientForTests();
    stripe = getStripeClient();

    const clock = await stripe.testHelpers.testClocks.create({
      frozen_time: Math.floor(Date.now() / 1000),
      name: `elcamoso-lifecycle-${Date.now()}`,
    });
    testClockId = clock.id;

    const customer = await stripe.customers.create({
      email: `lifecycle+${Date.now()}@example.com`,
      test_clock: testClockId,
      metadata: { userId: STRIPE_TEST_USER_ID },
    });
    customerId = customer.id;
    await memoryUserBillingRepository.setStripeCustomerId(STRIPE_TEST_USER_ID, customerId);

    const config = readStripeConfig();
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: config.prices.drive_plus_monthly }],
      metadata: {
        userId: STRIPE_TEST_USER_ID,
        elcamosoPlan: "DRIVE_PLUS",
        billingInterval: "month",
      },
    });
    subscriptionId = subscription.id;

    await syncStripeSubscriptionRecord(subscription);
    assertLocalEntitlements(STRIPE_TEST_USER_ID, {
      plan: "DRIVE_PLUS",
      status: "active",
      hasDrivePlusAccess: true,
    });
  }, 120_000);

  afterAll(async () => {
    if (!stripe || !testClockId) return;
    try {
      await stripe.testHelpers.testClocks.del(testClockId);
    } catch {
      /* clock may already be deleted */
    }
  }, 60_000);

  it("advancing test clock triggers renewal period and retains Drive+", async () => {
    const before = getSubscriptionForUser(STRIPE_TEST_USER_ID);
    expect(before?.plan).toBe("DRIVE_PLUS");

    const clock = await stripe.testHelpers.testClocks.retrieve(testClockId);
    const advanceTo = clock.frozen_time + 86_400 * 32;
    await stripe.testHelpers.testClocks.advance(testClockId, { frozen_time: advanceTo });

    await waitFor(async () => {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return sub.status === "active" && sub.current_period_end > clock.frozen_time;
    }, 60_000);

    const refreshed = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscriptionRecord(refreshed);

    assertLocalEntitlements(STRIPE_TEST_USER_ID, {
      plan: "DRIVE_PLUS",
      status: "active",
      hasDrivePlusAccess: true,
    });

    const after = getSubscriptionForUser(STRIPE_TEST_USER_ID);
    expect(after?.currentPeriodEnd?.getTime()).toBeGreaterThan(
      before?.currentPeriodEnd?.getTime() ?? 0,
    );
  }, 120_000);

  it("cancel at period end then clock advance expires subscription locally", async () => {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    const cancelPending = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscriptionRecord(cancelPending);

    assertLocalEntitlements(STRIPE_TEST_USER_ID, {
      plan: "DRIVE_PLUS",
      status: "active",
      hasDrivePlusAccess: true,
    });

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const advanceTo = sub.current_period_end + 86_400;
    await stripe.testHelpers.testClocks.advance(testClockId, { frozen_time: advanceTo });

    await waitFor(async () => {
      const latest = await stripe.subscriptions.retrieve(subscriptionId);
      return latest.status === "canceled" || latest.status === "past_due";
    }, 60_000);

    const expired = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscriptionRecord(expired);

    if (expired.status === "canceled") {
      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "FREE",
        status: "free",
        hasDrivePlusAccess: false,
      });
    }
  }, 120_000);
});

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 2000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for Stripe test clock condition");
}
