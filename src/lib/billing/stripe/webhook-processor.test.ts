import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import {
  constructStripeWebhookEvent,
  dispatchStripeWebhookEvent,
  resetWebhookEventStoreStateForTests,
} from "@/lib/billing/stripe/webhook";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";

const USER_ID = "33333333-3333-4333-8333-333333333333";

const subscriptionsRetrieve = vi.fn();
const subscriptionsList = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    webhooks: Stripe.webhooks,
    subscriptions: {
      retrieve: subscriptionsRetrieve,
      list: subscriptionsList,
    },
  }),
  resetStripeClientForTests: vi.fn(),
}));

function buildSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: "sub_test_123",
    object: "subscription",
    customer: "cus_test_123",
    status: "active",
    cancel_at_period_end: false,
    current_period_start: 1_700_000_000,
    current_period_end: 1_700_086_400,
    metadata: { userId: USER_ID, elcamosoPlan: "DRIVE_PLUS", billingInterval: "month" },
    items: {
      object: "list",
      data: [
        {
          id: "si_test",
          object: "subscription_item",
          price: { id: "price_month_test", object: "price" } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: "/v1/subscription_items",
    },
    ...overrides,
  } as Stripe.Subscription;
}

function signEvent(event: Stripe.Event, secret: string): { rawBody: string; signature: string } {
  const rawBody = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: rawBody,
    secret,
  });
  return { rawBody, signature };
}

describe("stripe webhook processor", () => {
  const webhookSecret = "whsec_test_secret";

  beforeEach(() => {
    resetWebhookEventStoreStateForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetUserBillingRepositoryForTests();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
    subscriptionsRetrieve.mockResolvedValue(buildSubscription());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid webhook signatures", () => {
    const { rawBody } = signEvent(
      { id: "evt_bad", object: "event", type: "invoice.paid" } as Stripe.Event,
      webhookSecret,
    );
    expect(() => constructStripeWebhookEvent(rawBody, "bad_signature")).toThrow(
      "Invalid Stripe webhook signature",
    );
  });

  it("processes checkout.session.completed and provisions Drive+ entitlements", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(USER_ID, "cus_test_123");

    const event = {
      id: "evt_checkout_1",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          object: "checkout.session",
          mode: "subscription",
          customer: "cus_test_123",
          subscription: "sub_test_123",
          client_reference_id: USER_ID,
          metadata: { userId: USER_ID },
        },
      },
    } as Stripe.Event;

    const result = await dispatchStripeWebhookEvent(event);
    expect(result.handled).toBe(true);
    expect(result.duplicate).toBe(false);

    const entitlement = getSubscriptionForUser(USER_ID);
    expect(entitlement).toMatchObject({
      plan: "DRIVE_PLUS",
      status: "active",
      interval: "month",
    });
  });

  it("is idempotent when the same event is replayed", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(USER_ID, "cus_test_123");

    const event = {
      id: "evt_replay_1",
      object: "event",
      type: "customer.subscription.updated",
      data: { object: buildSubscription() },
    } as Stripe.Event;

    const first = await dispatchStripeWebhookEvent(event);
    const second = await dispatchStripeWebhookEvent(event);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("downgrades entitlements when a subscription is deleted", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(USER_ID, "cus_test_123");

    const activeEvent = {
      id: "evt_sub_active",
      object: "event",
      type: "customer.subscription.updated",
      data: { object: buildSubscription({ status: "active" }) },
    } as Stripe.Event;
    await dispatchStripeWebhookEvent(activeEvent);

    const deletedEvent = {
      id: "evt_sub_deleted",
      object: "event",
      type: "customer.subscription.deleted",
      data: { object: buildSubscription({ status: "canceled" }) },
    } as Stripe.Event;
    await dispatchStripeWebhookEvent(deletedEvent);

    expect(getSubscriptionForUser(USER_ID)).toMatchObject({
      plan: "FREE",
      status: "free",
    });
  });

  it("handles invoice.payment_failed by syncing past_due state", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(USER_ID, "cus_test_123");
    subscriptionsRetrieve.mockResolvedValue(buildSubscription({ status: "past_due" }));

    const event = {
      id: "evt_invoice_failed",
      object: "event",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test",
          object: "invoice",
          subscription: "sub_test_123",
        },
      },
    } as Stripe.Event;

    await dispatchStripeWebhookEvent(event);
    expect(getSubscriptionForUser(USER_ID)).toMatchObject({
      plan: "DRIVE_PLUS",
      status: "past_due",
    });
  });

  it("supports paused and resumed subscription events", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(USER_ID, "cus_test_123");
    const { getSubscriptionRepository } = await import(
      "@/lib/billing/subscription-repository-memory"
    );

    await dispatchStripeWebhookEvent({
      id: "evt_paused",
      object: "event",
      type: "customer.subscription.paused",
      data: { object: buildSubscription({ status: "paused" }) },
    } as Stripe.Event);

    const paused = await getSubscriptionRepository().findByProviderSubscriptionId(
      "stripe",
      "sub_test_123",
    );
    expect(paused?.status).toBe("paused");
    expect(getSubscriptionForUser(USER_ID)).toMatchObject({ plan: "FREE", status: "free" });

    await dispatchStripeWebhookEvent({
      id: "evt_resumed",
      object: "event",
      type: "customer.subscription.resumed",
      data: { object: buildSubscription({ status: "active" }) },
    } as Stripe.Event);

    expect(getSubscriptionForUser(USER_ID)).toMatchObject({
      plan: "DRIVE_PLUS",
      status: "active",
    });
  });
});
