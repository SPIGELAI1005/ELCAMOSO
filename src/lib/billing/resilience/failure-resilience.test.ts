import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import { provisionEntitlementsFromSubscription } from "@/lib/billing/provision-entitlements";
import { persistAndProvisionSubscription } from "@/lib/billing/resilience/persist-subscription";
import {
  resolveLocalSubscriptionAccess,
  userHasLocalDrivePlusAccess,
} from "@/lib/billing/resilience/local-access";
import { BillingServiceUnavailableError } from "@/lib/billing/resilience/stripe-errors";
import { createStripePortalSession } from "@/lib/billing/stripe/portal";
import {
  getSubscriptionRepository,
  memorySubscriptionRepository,
  resetSubscriptionRepositoryStoreForTests,
} from "@/lib/billing/subscription-repository-memory";
import {
  getSubscriptionForUser,
  resetSubscriptionStoreForTests,
} from "@/lib/billing/subscription-store";
import type { Subscription } from "@/lib/billing/types";
import {
  dispatchStripeWebhookEvent,
  resetWebhookEventStoreStateForTests,
} from "@/lib/billing/stripe/webhook";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import { PREMIUM_ENTITLEMENTS } from "@/lib/entitlements/plans";
import { buildEntitlementSnapshot } from "@/lib/entitlements/resolve";
import type { EntitlementUser } from "@/lib/entitlements/types";

const USER_ID = "55555555-5555-4555-8555-555555555555";

function baseSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-resilience-1",
    userId: USER_ID,
    provider: "stripe",
    providerCustomerId: "cus_resilience",
    providerSubscriptionId: "sub_resilience",
    plan: "DRIVE_PLUS",
    interval: "month",
    status: "active",
    currentPeriodStart: new Date("2026-08-01"),
    currentPeriodEnd: new Date("2026-09-01"),
    cancelAtPeriodEnd: false,
    createdAt: new Date("2026-08-01"),
    updatedAt: new Date("2026-08-01"),
    ...overrides,
  };
}

function freeEntitlementUser(): EntitlementUser {
  return {
    accountId: null,
    plan: "FREE",
    subscriptionStatus: "none",
    trialStatus: "none",
    revision: 0,
  };
}

const customersCreate = vi.fn();
const customersRetrieve = vi.fn();
const checkoutCreate = vi.fn();
const subscriptionsList = vi.fn();
const portalCreate = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    customers: { create: customersCreate, retrieve: customersRetrieve },
    checkout: { sessions: { create: checkoutCreate } },
    subscriptions: { list: subscriptionsList, retrieve: vi.fn() },
    billingPortal: { sessions: { create: portalCreate } },
  }),
  resetStripeClientForTests: vi.fn(),
}));

describe("billing failure resilience", () => {
  beforeEach(() => {
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetWebhookEventStoreStateForTests();
    resetUserBillingRepositoryForTests();
    process.env.MONETIZATION_ENABLED = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
    customersCreate.mockResolvedValue({ id: "cus_new" });
    customersRetrieve.mockResolvedValue({ id: "cus_existing", deleted: false });
    subscriptionsList.mockResolvedValue({ data: [] });
    portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/portal" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("FREE Drive entitlements work with no subscription and no Stripe", () => {
    const snapshot = buildEntitlementSnapshot(freeEntitlementUser());
    expect(snapshot.entitlements).toContain("basic_drive");
    expect(snapshot.entitlements).toContain("basic_sound_profiles");
    expect(snapshot.entitlements).not.toContain("dynamic_drive");
  });

  it("premium gates read local store only - no Stripe on access check", () => {
    provisionEntitlementsFromSubscription(baseSubscription());
    expect(userHasLocalDrivePlusAccess(USER_ID)).toBe(true);
    expect(subscriptionsList).not.toHaveBeenCalled();
  });

  it("simulates Stripe API unavailable during checkout without changing entitlements", async () => {
    checkoutCreate.mockRejectedValue({ type: "StripeConnectionError" });

    await expect(
      beginDrivePlusCheckout({
        userId: USER_ID,
        email: "driver@example.com",
        origin: "http://localhost:5173",
        request: { plan: "drive_plus", interval: "monthly" },
      }),
    ).rejects.toBeInstanceOf(BillingServiceUnavailableError);

    expect(getSubscriptionForUser(USER_ID)).toBeNull();
    const snapshot = buildEntitlementSnapshot(freeEntitlementUser());
    expect(snapshot.entitlements).toContain("basic_drive");
  });

  it("simulates payment failure with past_due grace - Drive+ retained locally", () => {
    provisionEntitlementsFromSubscription(
      baseSubscription({ status: "past_due", updatedAt: new Date() }),
    );
    const access = resolveLocalSubscriptionAccess(USER_ID);
    expect(access.hasDrivePlusAccess).toBe(true);
    expect(access.reason).toBe("past_due_grace");
  });

  it("simulates subscription canceled after period end - FREE locally", () => {
    provisionEntitlementsFromSubscription(
      baseSubscription({
        status: "canceled",
        currentPeriodEnd: new Date("2020-01-01"),
      }),
    );
    expect(getSubscriptionForUser(USER_ID)).toMatchObject({ plan: "FREE", status: "free" });
  });

  it("simulates subscription renewed - active with new period", () => {
    provisionEntitlementsFromSubscription(
      baseSubscription({
        status: "active",
        currentPeriodEnd: new Date("2026-10-01"),
      }),
    );
    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(true);
  });

  it("simulates database unavailable - webhook still provisions memory entitlements", async () => {
    const upsert = vi
      .spyOn(memorySubscriptionRepository, "upsert")
      .mockRejectedValue(new Error("database unavailable"));

    const result = await persistAndProvisionSubscription({
      userId: USER_ID,
      provider: "stripe",
      providerCustomerId: "cus_resilience",
      providerSubscriptionId: "sub_resilience",
      plan: "DRIVE_PLUS",
      interval: "month",
      status: "active",
      currentPeriodStart: new Date("2026-08-01"),
      currentPeriodEnd: new Date("2026-09-01"),
      cancelAtPeriodEnd: false,
    });

    expect(result.persisted).toBe(false);
    expect(getSubscriptionForUser(USER_ID)).toMatchObject({ plan: "DRIVE_PLUS" });

    upsert.mockRestore();
  });

  it("simulates duplicated webhook - second dispatch is idempotent", async () => {
    const event = {
      id: "evt_duplicate_1",
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_resilience",
          object: "subscription",
          customer: "cus_resilience",
          status: "active",
          cancel_at_period_end: false,
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_086_400,
          metadata: { userId: USER_ID, elcamosoPlan: "DRIVE_PLUS", billingInterval: "month" },
          items: {
            object: "list",
            data: [{ price: { id: "price_month_test" } }],
          },
        },
      },
    } as never;

    vi.spyOn(getSubscriptionRepository(), "upsert").mockImplementation(async (input) =>
      baseSubscription({
        providerSubscriptionId: input.providerSubscriptionId,
        status: input.status,
      }),
    );

    const first = await dispatchStripeWebhookEvent(event);
    const second = await dispatchStripeWebhookEvent(event);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("simulates webhook delayed - FREE until local store updated", () => {
    expect(userHasLocalDrivePlusAccess(USER_ID)).toBe(false);
    const snapshot = buildEntitlementSnapshot(freeEntitlementUser());
    expect(snapshot.entitlements).toContain("basic_drive");
    provisionEntitlementsFromSubscription(baseSubscription());
    expect(userHasLocalDrivePlusAccess(USER_ID)).toBe(true);
  });

  it("simulates customer portal unavailable - throws without touching entitlements", async () => {
    provisionEntitlementsFromSubscription(baseSubscription());
    portalCreate.mockRejectedValue({ type: "StripeConnectionError" });

    await expect(
      createStripePortalSession({
        stripeCustomerId: "cus_resilience",
        origin: "http://localhost:5173",
      }),
    ).rejects.toBeInstanceOf(BillingServiceUnavailableError);

    expect(resolveLocalSubscriptionAccess(USER_ID).hasDrivePlusAccess).toBe(true);
  });

  it("simulates expired checkout - no entitlement change until webhook", () => {
    expect(getSubscriptionForUser(USER_ID)).toBeNull();
    const snapshot = buildEntitlementSnapshot(freeEntitlementUser());
    expect(snapshot.entitlements).toContain("basic_drive");
  });

  it("live drive hold keeps premium entitlements when billing downgrades mid-drive", async () => {
    const { beginLiveDriveAccess, endLiveDriveAccess, hasEntitlementDuringLiveDriveHold } =
      await import("@/lib/entitlements/live-drive-access");

    provisionEntitlementsFromSubscription(baseSubscription());
    beginLiveDriveAccess(PREMIUM_ENTITLEMENTS);
    provisionEntitlementsFromSubscription(
      baseSubscription({ status: "canceled", currentPeriodEnd: new Date("2020-01-01") }),
    );
    expect(hasEntitlementDuringLiveDriveHold("dynamic_drive")).toBe(true);
    endLiveDriveAccess();
    expect(getSubscriptionForUser(USER_ID)?.plan).toBe("FREE");
  });
});
