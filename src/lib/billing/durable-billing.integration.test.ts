import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetAccountAuthStoreForTests } from "@/lib/account/session-store";
import {
  hydrateUserBillingState,
  persistEntitlementGrantsForAccount,
  resetDurableBillingStateForTests,
  resolveDurableUserIdForEmail,
} from "@/lib/billing/durable-state.server";
import { hasActiveLifetimeGrant, resetLifetimeStoreForTests } from "@/lib/billing/lifetime-store";
import { resolveLocalSubscriptionAccess } from "@/lib/billing/resilience/local-access";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import { getSubscriptionForUser, resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import { dispatchStripeWebhookEvent, resetWebhookEventStoreStateForTests } from "@/lib/billing/stripe/webhook";
import {
  resetUserBillingStoreForTests,
  setUserBillingRepository,
} from "@/lib/billing/user-billing-store";
import { postgresUserBillingRepository } from "@/lib/billing/user-billing-repository-postgres";
import { setDbOverrideForTests } from "@/lib/db/client";
import { entitlementGrants, stripeWebhookEvents, subscriptions, users } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/lib/db/test-client";
import {
  activeGrantedProfileIds,
  resetEntitlementGrantsForTests,
  upsertEntitlementGrant,
} from "@/lib/entitlements/grants";

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({ webhooks: Stripe.webhooks }),
  resetStripeClientForTests: vi.fn(),
}));

const USER_ID = "66666666-6666-4666-8666-666666666666";
const ENV: Record<string, string> = {
  DATABASE_URL: "postgres://pglite-test/elcamoso",
  MONETIZATION_ENABLED: "1",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  STRIPE_PRICE_DRIVE_PLUS_MONTHLY: "price_month_test",
  STRIPE_PRICE_DRIVE_PLUS_YEARLY: "price_year_test",
  STRIPE_PRICE_DRIVE_PLUS_LIFETIME: "price_lifetime_test",
};
const previous: Record<string, string | undefined> = {};

/** Simulates a new serverless instance / cold start: every in-memory store is wiped. */
function restartInstance(): void {
  resetSubscriptionStoreForTests();
  resetLifetimeStoreForTests();
  resetEntitlementGrantsForTests();
  resetSubscriptionRepositoryStoreForTests();
  resetUserBillingStoreForTests();
  setUserBillingRepository(postgresUserBillingRepository);
  resetWebhookEventStoreStateForTests();
  resetDurableBillingStateForTests();
  resetAccountAuthStoreForTests();
}

function event(id: string, type: string, object: unknown): Stripe.Event {
  return { id, type, object: "event", data: { object } } as unknown as Stripe.Event;
}

function lifetimeSession(): Stripe.Checkout.Session {
  return {
    id: "cs_durable_1",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    customer: "cus_durable",
    payment_intent: "pi_durable_1",
    client_reference_id: USER_ID,
    created: 1_790_000_000,
    metadata: { userId: USER_ID, commercialPlanId: "drive_plus_lifetime", elcamosoPlan: "DRIVE_PLUS" },
  } as unknown as Stripe.Checkout.Session;
}

function monthlySubscription(status: Stripe.Subscription.Status): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: "sub_durable_1",
    object: "subscription",
    customer: "cus_durable",
    status,
    cancel_at_period_end: false,
    metadata: { userId: USER_ID, elcamosoPlan: "DRIVE_PLUS" },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          object: "subscription_item",
          price: { id: "price_month_test", object: "price" },
          current_period_start: now - 86_400,
          current_period_end: status === "canceled" ? now - 60 : now + 29 * 86_400,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

describe("durable billing state (Postgres)", () => {
  let db: TestDb;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeEach(async () => {
    for (const [k, v] of Object.entries(ENV)) {
      previous[k] = process.env[k];
      process.env[k] = v;
    }
    ({ db, client } = await createTestDb());
    setDbOverrideForTests(db);
    restartInstance();
  });

  afterEach(async () => {
    setDbOverrideForTests(null);
    for (const k of Object.keys(ENV)) {
      if (previous[k] === undefined) delete process.env[k];
      else process.env[k] = previous[k];
    }
    await client.close();
  });

  it("subscription granted by webhook resolves on a fresh instance", async () => {
    await dispatchStripeWebhookEvent(
      event("evt_sub_1", "customer.subscription.updated", monthlySubscription("active")),
    );
    expect((await db.select().from(subscriptions)).length).toBe(1);
    expect((await db.select().from(users))[0]?.stripeCustomerId).toBe("cus_durable");
    expect((await db.select().from(stripeWebhookEvents))[0]?.status).toBe("succeeded");

    restartInstance();
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(false);
    await hydrateUserBillingState(USER_ID);
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(true);
    expect(getSubscriptionForUser(USER_ID)?.interval).toBe("month");

    // Cancellation processed on yet another instance is visible after the next hydrate.
    restartInstance();
    await dispatchStripeWebhookEvent(
      event("evt_sub_2", "customer.subscription.deleted", monthlySubscription("canceled")),
    );
    restartInstance();
    await hydrateUserBillingState(USER_ID);
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(false);
  });

  it("lifetime survives restarts and outranks a later subscription cancellation", async () => {
    await dispatchStripeWebhookEvent(event("evt_lt_1", "checkout.session.completed", lifetimeSession()));
    restartInstance();
    await hydrateUserBillingState(USER_ID);
    expect(hasActiveLifetimeGrant(USER_ID)).toBe(true);
    expect(getSubscriptionForUser(USER_ID)?.lifetime).toBe(true);
    expect(resolveLocalSubscriptionAccess(USER_ID, Date.UTC(2099, 0, 1)).hasDrivePlusAccess).toBe(true);

    // Webhook replayed on a fresh instance is deduplicated by the Postgres event ledger.
    restartInstance();
    const replay = await dispatchStripeWebhookEvent(
      event("evt_lt_1", "checkout.session.completed", lifetimeSession()),
    );
    expect(replay.duplicate).toBe(true);

    restartInstance();
    await dispatchStripeWebhookEvent(
      event("evt_sub_c", "customer.subscription.deleted", monthlySubscription("canceled")),
    );
    restartInstance();
    await hydrateUserBillingState(USER_ID);
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(true);
  });

  it("refund on another instance revokes lifetime everywhere", async () => {
    await dispatchStripeWebhookEvent(event("evt_lt_2", "checkout.session.completed", lifetimeSession()));
    restartInstance();
    await dispatchStripeWebhookEvent(
      event("evt_refund", "charge.refunded", {
        id: "ch_1",
        payment_intent: "pi_durable_1",
        customer: "cus_durable",
        metadata: {},
      }),
    );
    restartInstance();
    await hydrateUserBillingState(USER_ID);
    expect(hasActiveLifetimeGrant(USER_ID)).toBe(false);
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(false);
  });

  it("purchased / reward unlocks persist and hydrate", async () => {
    upsertEntitlementGrant({
      accountId: USER_ID,
      kind: "purchased_profile",
      profileId: "american_muscle_v8",
      entitlement: null,
      expiresAt: null,
      source: "test",
    });
    expect(await persistEntitlementGrantsForAccount(USER_ID)).toBe(1);
    expect(await persistEntitlementGrantsForAccount(USER_ID)).toBe(1);
    expect((await db.select().from(entitlementGrants)).length).toBe(1);
    restartInstance();
    expect(activeGrantedProfileIds(USER_ID)).toEqual([]);
    await hydrateUserBillingState(USER_ID);
    expect(activeGrantedProfileIds(USER_ID)).toEqual(["american_muscle_v8"]);
  });

  it("keeps the same account id for an email across instances", async () => {
    const first = await resolveDurableUserIdForEmail("Driver@Example.com", () => USER_ID);
    restartInstance();
    const second = await resolveDurableUserIdForEmail(
      "driver@example.com",
      () => "77777777-7777-4777-8777-777777777777",
    );
    expect(first).toBe(USER_ID);
    expect(second).toBe(USER_ID);
  });

  it("is a no-op without DATABASE_URL", async () => {
    delete process.env["DATABASE_URL"];
    expect(await hydrateUserBillingState(USER_ID)).toBe(false);
    expect(await resolveDurableUserIdForEmail("x@example.com", () => USER_ID)).toBeNull();
  });
});
