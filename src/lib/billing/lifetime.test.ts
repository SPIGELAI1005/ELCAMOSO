import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginDrivePlusCheckout, buildLifetimeCheckoutParams } from "@/lib/billing/checkout-service";
import { hasActiveLifetimeGrant, resetLifetimeStoreForTests } from "@/lib/billing/lifetime-store";
import { resolveLocalSubscriptionAccess } from "@/lib/billing/resilience/local-access";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import {
  getSubscriptionForUser,
  resetSubscriptionStoreForTests,
  setSubscriptionForUser,
} from "@/lib/billing/subscription-store";
import { dispatchStripeWebhookEvent, resetWebhookEventStoreStateForTests } from "@/lib/billing/stripe/webhook";
import { syncStripeSubscriptionRecord } from "@/lib/billing/stripe/subscription-sync";
import { getDrivePlusLifetimeDisplay } from "@/lib/billing/plan-display";
import { parseCheckoutPlanRequest } from "@/lib/billing/checkout-request";
import { resetUserBillingRepositoryForTests } from "@/lib/billing/user-billing-store";

const USER_ID = "55555555-5555-4555-8555-555555555555";
const checkoutCreate = vi.fn();
const customersCreate = vi.fn();
const portalCreate = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    webhooks: Stripe.webhooks,
    customers: { create: customersCreate, retrieve: vi.fn() },
    checkout: { sessions: { create: checkoutCreate } },
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
    billingPortal: { sessions: { create: portalCreate } },
  }),
  resetStripeClientForTests: vi.fn(),
}));

const ENV = {
  MONETIZATION_ENABLED: "1",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_DRIVE_PLUS_MONTHLY: "price_month_test",
  STRIPE_PRICE_DRIVE_PLUS_YEARLY: "price_year_test",
  STRIPE_PRICE_DRIVE_PLUS_LIFETIME: "price_lifetime_test",
};
const previous: Record<string, string | undefined> = {};

function lifetimeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_lifetime_1",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    customer: "cus_lifetime",
    payment_intent: "pi_lifetime_1",
    client_reference_id: USER_ID,
    created: 1_790_000_000,
    metadata: { userId: USER_ID, commercialPlanId: "drive_plus_lifetime", elcamosoPlan: "DRIVE_PLUS" },
    ...overrides,
  } as Stripe.Checkout.Session;
}

function event(id: string, type: string, object: unknown): Stripe.Event {
  return { id, type, object: "event", data: { object } } as unknown as Stripe.Event;
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) {
    previous[k] = process.env[k];
    process.env[k] = v;
  }
  resetLifetimeStoreForTests();
  resetSubscriptionStoreForTests();
  resetSubscriptionRepositoryStoreForTests();
  resetUserBillingRepositoryForTests();
  resetWebhookEventStoreStateForTests();
  checkoutCreate.mockReset();
  customersCreate.mockReset();
  customersCreate.mockResolvedValue({ id: "cus_lifetime" });
  checkoutCreate.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.test/cs_new" });
  portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/portal" });
});

afterEach(() => {
  for (const k of Object.keys(ENV)) {
    if (previous[k] === undefined) delete process.env[k];
    else process.env[k] = previous[k];
  }
});

describe("Drive+ Lifetime display", () => {
  it("shows €38.99 once with the early adopter struck-through list price", () => {
    const d = getDrivePlusLifetimeDisplay();
    expect(d.amount).toBe("€38.99");
    expect(d.listAmount).toBe("€45.34");
    expect(d.cadence).toBe("once");
  });

  it("parses lifetime checkout requests", () => {
    expect(parseCheckoutPlanRequest({ plan: "drive_plus", interval: "lifetime" })?.interval).toBe(
      "lifetime",
    );
  });
});

describe("lifetime checkout payload", () => {
  it("uses payment mode with the env price id and no subscription data", async () => {
    const result = await beginDrivePlusCheckout({
      userId: USER_ID,
      email: "driver@example.com",
      origin: "http://localhost:3000",
      trustedHost: "localhost:3000",
      request: { plan: "drive_plus", interval: "lifetime", returnPath: "/pricing" },
    });
    expect(result.action).toBe("checkout");
    const params = checkoutCreate.mock.calls[0]![0] as Stripe.Checkout.SessionCreateParams;
    expect(params.mode).toBe("payment");
    expect(params.line_items).toEqual([{ price: "price_lifetime_test", quantity: 1 }]);
    expect(params.subscription_data).toBeUndefined();
    expect(params.metadata?.["commercialPlanId"]).toBe("drive_plus_lifetime");
    expect(params.payment_intent_data?.metadata?.["userId"]).toBe(USER_ID);
  });

  it("allows lifetime while subscribed and returns a cancel note", async () => {
    setSubscriptionForUser({ userId: USER_ID, plan: "DRIVE_PLUS", status: "active", interval: "month" });
    const result = await beginDrivePlusCheckout({
      userId: USER_ID,
      email: "driver@example.com",
      origin: "http://localhost:3000",
      trustedHost: "localhost:3000",
      request: { plan: "drive_plus", interval: "lifetime" },
    });
    expect(result.action).toBe("checkout");
    expect(result.action === "checkout" && result.note).toMatch(/cancel/i);
    const params = checkoutCreate.mock.calls[0]![0] as Stripe.Checkout.SessionCreateParams;
    expect(params.metadata?.["hadActiveSubscription"]).toBe("true");
  });

  it("builds a payment-mode payload", () => {
    const params = buildLifetimeCheckoutParams({
      priceId: "price_x",
      stripeCustomerId: "cus_x",
      origin: "https://www.elcamoso.com",
      returnPath: "/pricing",
      userId: USER_ID,
      metadata: { userId: USER_ID },
    });
    expect(params.mode).toBe("payment");
    expect(params.success_url).toContain("billing=success");
  });
});

describe("lifetime webhooks", () => {
  it("grants Drive+ forever, idempotently, and revokes on refund", async () => {
    await dispatchStripeWebhookEvent(event("evt_1", "checkout.session.completed", lifetimeSession()));
    // Replay with a new event id - grant stays single.
    await dispatchStripeWebhookEvent(event("evt_2", "checkout.session.completed", lifetimeSession()));
    expect(hasActiveLifetimeGrant(USER_ID)).toBe(true);
    const record = getSubscriptionForUser(USER_ID);
    expect(record?.plan).toBe("DRIVE_PLUS");
    expect(record?.lifetime).toBe(true);
    expect(record?.currentPeriodEnd).toBeNull();
    const farFuture = Date.UTC(2099, 0, 1);
    expect(resolveLocalSubscriptionAccess(USER_ID, farFuture).hasDrivePlusAccess).toBe(true);

    await dispatchStripeWebhookEvent(
      event("evt_3", "charge.refunded", { id: "ch_1", payment_intent: "pi_lifetime_1", customer: "cus_lifetime", metadata: {} }),
    );
    expect(hasActiveLifetimeGrant(USER_ID)).toBe(false);
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(false);
  });

  it("waits for async payments", async () => {
    await dispatchStripeWebhookEvent(
      event("evt_a", "checkout.session.completed", lifetimeSession({ payment_status: "unpaid" })),
    );
    expect(hasActiveLifetimeGrant(USER_ID)).toBe(false);
    await dispatchStripeWebhookEvent(
      event("evt_b", "checkout.session.async_payment_succeeded", lifetimeSession()),
    );
    expect(hasActiveLifetimeGrant(USER_ID)).toBe(true);
  });

  it("keeps lifetime access when a recurring subscription is later canceled", async () => {
    await dispatchStripeWebhookEvent(event("evt_l", "checkout.session.completed", lifetimeSession()));
    await syncStripeSubscriptionRecord({
      id: "sub_old",
      object: "subscription",
      customer: "cus_lifetime",
      status: "canceled",
      cancel_at_period_end: false,
      metadata: { userId: USER_ID, elcamosoPlan: "DRIVE_PLUS" },
      items: {
        object: "list",
        data: [
          {
            id: "si",
            object: "subscription_item",
            price: { id: "price_month_test", object: "price" },
            current_period_start: 1_700_000_000,
            current_period_end: 1_700_086_400,
          },
        ],
      },
    } as unknown as Stripe.Subscription);
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(true);
    expect(getSubscriptionForUser(USER_ID)?.lifetime).toBe(true);
  });

  it("ignores payment sessions that are not lifetime", async () => {
    await dispatchStripeWebhookEvent(
      event("evt_x", "checkout.session.completed", lifetimeSession({ metadata: { userId: USER_ID } })),
    );
    expect(hasActiveLifetimeGrant(USER_ID)).toBe(false);
  });
});
