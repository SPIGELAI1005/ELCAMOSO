import type Stripe from "stripe";
import { expect } from "vitest";

import { resolveLocalSubscriptionAccess } from "@/lib/billing/resilience/local-access";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import type { BillingInterval, BillingStatus } from "@/lib/billing/status";
import { buildEntitlementSnapshot } from "@/lib/entitlements/resolve";
import { entitlementsForPlan } from "@/lib/entitlements/plans";
import type { Entitlement, Plan } from "@/lib/entitlements/types";
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";

export const STRIPE_TEST_USER_ID = "44444444-4444-4444-8444-444444444444";
export const STRIPE_TEST_CUSTOMER_ID = "cus_lifecycle_test";
export const STRIPE_TEST_SUBSCRIPTION_ID = "sub_lifecycle_test";

export const STRIPE_TEST_ENV = {
  MONETIZATION_ENABLED: "1",
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_test_lifecycle",
  STRIPE_PRICE_DRIVE_PLUS_MONTHLY: "price_month_test",
  STRIPE_PRICE_DRIVE_PLUS_YEARLY: "price_year_test",
} as const;

export function applyStripeTestEnv(): void {
  for (const [key, value] of Object.entries(STRIPE_TEST_ENV)) {
    process.env[key] = value;
  }
}

export function buildStripeSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: STRIPE_TEST_SUBSCRIPTION_ID,
    object: "subscription",
    customer: STRIPE_TEST_CUSTOMER_ID,
    status: "active",
    cancel_at_period_end: false,
    current_period_start: 1_700_000_000,
    current_period_end: 1_700_086_400,
    metadata: {
      userId: STRIPE_TEST_USER_ID,
      elcamosoPlan: "DRIVE_PLUS",
      billingInterval: "month",
    },
    items: {
      object: "list",
      data: [
        {
          id: "si_lifecycle",
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

export function buildYearlyStripeSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return buildStripeSubscription({
    metadata: {
      userId: STRIPE_TEST_USER_ID,
      elcamosoPlan: "DRIVE_PLUS",
      billingInterval: "year",
    },
    items: {
      object: "list",
      data: [
        {
          id: "si_lifecycle_year",
          object: "subscription_item",
          price: { id: "price_year_test", object: "price" } as Stripe.Price,
        } as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: "/v1/subscription_items",
    },
    ...overrides,
  });
}

export function buildCheckoutCompletedEvent(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Event {
  return {
    id: `evt_checkout_${Date.now()}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_lifecycle",
        object: "checkout.session",
        mode: "subscription",
        customer: STRIPE_TEST_CUSTOMER_ID,
        subscription: STRIPE_TEST_SUBSCRIPTION_ID,
        client_reference_id: STRIPE_TEST_USER_ID,
        metadata: { userId: STRIPE_TEST_USER_ID, plan: "drive_plus", interval: "monthly" },
        ...overrides,
      } as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

export function buildSubscriptionEvent(
  type: Stripe.Event.Type,
  subscription: Stripe.Subscription,
  eventId?: string,
): Stripe.Event {
  return {
    id: eventId ?? `evt_${type}_${Date.now()}`,
    object: "event",
    type,
    data: { object: subscription },
  } as Stripe.Event;
}

export function buildInvoiceEvent(
  type: "invoice.paid" | "invoice.payment_failed",
  subscriptionId = STRIPE_TEST_SUBSCRIPTION_ID,
  eventId?: string,
): Stripe.Event {
  return {
    id: eventId ?? `evt_${type}_${Date.now()}`,
    object: "event",
    type,
    data: {
      object: {
        id: `in_${type}`,
        object: "invoice",
        subscription: subscriptionId,
      } as Stripe.Invoice,
    },
  } as Stripe.Event;
}

export interface ExpectedEntitlements {
  plan: Plan;
  status?: BillingStatus | "free" | "none";
  interval?: BillingInterval | null;
  hasDrivePlusAccess?: boolean;
  entitlements?: Entitlement[];
}

/** Assert local runtime store + access policy after a lifecycle event. */
export function assertLocalEntitlements(
  userId: string,
  expected: ExpectedEntitlements,
  now = Date.now(),
): void {
  const record = getSubscriptionForUser(userId);
  const access = resolveLocalSubscriptionAccess(userId, now);

  if (expected.plan === "FREE") {
    expect(record?.plan ?? "FREE").toBe("FREE");
  } else {
    expect(record).toMatchObject({
      plan: "DRIVE_PLUS",
      ...(expected.status ? { status: expected.status } : {}),
      ...(expected.interval !== undefined ? { interval: expected.interval } : {}),
    });
  }

  if (expected.hasDrivePlusAccess !== undefined) {
    expect(access.hasDrivePlusAccess).toBe(expected.hasDrivePlusAccess);
  } else if (record && hasDrivePlusSubscriptionAccess(record, now)) {
    expect(access.hasDrivePlusAccess).toBe(true);
  }

  if (expected.entitlements) {
    const snapshot = buildEntitlementSnapshot(
      {
        accountId: userId,
        plan: expected.plan,
        subscriptionStatus:
          expected.status === "active"
            ? "active"
            : expected.status === "past_due"
              ? "past_due"
              : expected.status === "trialing"
                ? "trialing"
                : expected.status === "canceled"
                  ? "canceled"
                  : "none",
        trialStatus: "none",
        revision: 0,
      },
      now,
    );
    for (const entitlement of expected.entitlements) {
      expect(snapshot.entitlements).toContain(entitlement);
    }
  } else if (expected.plan === "DRIVE_PLUS" && access.hasDrivePlusAccess) {
    const snapshot = buildEntitlementSnapshot(
      {
        accountId: userId,
        plan: "DRIVE_PLUS",
        subscriptionStatus: "active",
        trialStatus: "none",
        revision: 0,
      },
      now,
    );
    for (const entitlement of entitlementsForPlan("DRIVE_PLUS")) {
      expect(snapshot.entitlements).toContain(entitlement);
    }
  } else if (expected.plan === "FREE") {
    const snapshot = buildEntitlementSnapshot(
      {
        accountId: userId,
        plan: "FREE",
        subscriptionStatus: "none",
        trialStatus: "none",
        revision: 0,
      },
      now,
    );
    expect(snapshot.entitlements).toEqual(expect.arrayContaining(["basic_drive", "basic_sound_profiles"]));
    expect(snapshot.entitlements).not.toContain("dynamic_drive");
  }
}
