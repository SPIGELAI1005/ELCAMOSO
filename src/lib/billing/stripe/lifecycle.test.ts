import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import { createStripePortalSession } from "@/lib/billing/stripe/portal";
import { dispatchStripeWebhookEvent } from "@/lib/billing/stripe/webhook";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import { resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import { setSubscriptionForUser } from "@/lib/billing/subscription-store";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import { resetWebhookEventStoreStateForTests } from "@/lib/billing/webhook-event-store-memory";
import {
  applyStripeTestEnv,
  assertLocalEntitlements,
  buildCheckoutCompletedEvent,
  buildInvoiceEvent,
  buildStripeSubscription,
  buildSubscriptionEvent,
  buildYearlyStripeSubscription,
  STRIPE_TEST_CUSTOMER_ID,
  STRIPE_TEST_SUBSCRIPTION_ID,
  STRIPE_TEST_USER_ID,
} from "@/lib/billing/stripe/test-fixtures";

const subscriptionsRetrieve = vi.fn();
const subscriptionsList = vi.fn();
const checkoutCreate = vi.fn();
const portalCreate = vi.fn();
const customersCreate = vi.fn();
const customersRetrieve = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    webhooks: Stripe.webhooks,
    customers: { create: customersCreate, retrieve: customersRetrieve },
    checkout: { sessions: { create: checkoutCreate } },
    subscriptions: { retrieve: subscriptionsRetrieve, list: subscriptionsList },
    billingPortal: { sessions: { create: portalCreate } },
  }),
  resetStripeClientForTests: vi.fn(),
}));

describe("stripe subscription lifecycle (test mode)", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    resetWebhookEventStoreStateForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetSubscriptionStoreForTests();
    resetUserBillingRepositoryForTests();
    applyStripeTestEnv();
    await memoryUserBillingRepository.setStripeCustomerId(
      STRIPE_TEST_USER_ID,
      STRIPE_TEST_CUSTOMER_ID,
    );
    subscriptionsRetrieve.mockImplementation(async () => buildStripeSubscription());
    customersCreate.mockResolvedValue({ id: STRIPE_TEST_CUSTOMER_ID });
    customersRetrieve.mockResolvedValue({ id: STRIPE_TEST_CUSTOMER_ID, deleted: false });
    checkoutCreate.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.test/cs_test",
    });
    portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/portal" });
    subscriptionsList.mockResolvedValue({ data: [] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("new subscription", () => {
    it("monthly: checkout.session.completed provisions Drive+ entitlements", async () => {
      await dispatchStripeWebhookEvent(buildCheckoutCompletedEvent());

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        interval: "month",
        hasDrivePlusAccess: true,
      });
    });

    it("annual: checkout with yearly price provisions year interval", async () => {
      subscriptionsRetrieve.mockResolvedValue(buildYearlyStripeSubscription());

      await dispatchStripeWebhookEvent(
        buildCheckoutCompletedEvent({
          metadata: { userId: STRIPE_TEST_USER_ID, plan: "drive_plus", interval: "yearly" },
        }),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        interval: "year",
        hasDrivePlusAccess: true,
      });
    });
  });

  describe("duplicate checkout prevention", () => {
    it("redirects active Drive+ subscribers to portal instead of new checkout", async () => {
      setSubscriptionForUser({
        userId: STRIPE_TEST_USER_ID,
        plan: "DRIVE_PLUS",
        status: "active",
        interval: "month",
      });

      const result = await beginDrivePlusCheckout({
        userId: STRIPE_TEST_USER_ID,
        email: "driver@example.com",
        origin: "http://localhost:5173",
        request: { plan: "drive_plus", interval: "monthly" },
      });

      expect(result.action).toBe("manage");
      expect(checkoutCreate).not.toHaveBeenCalled();
      expect(portalCreate).toHaveBeenCalled();
      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        hasDrivePlusAccess: true,
      });
    });
  });

  describe("payment outcomes", () => {
    beforeEach(async () => {
      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent("customer.subscription.created", buildStripeSubscription()),
      );
    });

    it("successful payment: invoice.paid keeps Drive+ active", async () => {
      subscriptionsRetrieve.mockResolvedValue(
        buildStripeSubscription({
          status: "active",
          current_period_end: 1_700_172_800,
        }),
      );

      await dispatchStripeWebhookEvent(buildInvoiceEvent("invoice.paid", STRIPE_TEST_SUBSCRIPTION_ID, "evt_paid_1"));

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        hasDrivePlusAccess: true,
      });
    });

    it("failed payment: invoice.payment_failed sets past_due with grace access", async () => {
      subscriptionsRetrieve.mockResolvedValue(buildStripeSubscription({ status: "past_due" }));

      await dispatchStripeWebhookEvent(
        buildInvoiceEvent("invoice.payment_failed", STRIPE_TEST_SUBSCRIPTION_ID, "evt_failed_1"),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "past_due",
        hasDrivePlusAccess: true,
      });
    });
  });

  describe("renewal", () => {
    it("invoice.paid advances period and retains Drive+", async () => {
      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent("customer.subscription.created", buildStripeSubscription()),
      );

      const renewedPeriodEnd = 1_700_259_200;
      subscriptionsRetrieve.mockResolvedValue(
        buildStripeSubscription({
          status: "active",
          current_period_start: 1_700_086_400,
          current_period_end: renewedPeriodEnd,
        }),
      );

      await dispatchStripeWebhookEvent(buildInvoiceEvent("invoice.paid", STRIPE_TEST_SUBSCRIPTION_ID, "evt_renewal"));

      const record = (await import("@/lib/billing/subscription-store")).getSubscriptionForUser(
        STRIPE_TEST_USER_ID,
      );
      expect(record?.currentPeriodEnd?.getTime()).toBe(renewedPeriodEnd * 1000);
      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        hasDrivePlusAccess: true,
      });
    });
  });

  describe("cancellation", () => {
    beforeEach(async () => {
      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent("customer.subscription.created", buildStripeSubscription()),
      );
    });

    it("cancel at period end: retains Drive+ until period ends", async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 86_400 * 14;
      subscriptionsRetrieve.mockResolvedValue(
        buildStripeSubscription({
          status: "active",
          cancel_at_period_end: true,
          current_period_end: periodEnd,
        }),
      );

      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent(
          "customer.subscription.updated",
          buildStripeSubscription({
            status: "active",
            cancel_at_period_end: true,
            current_period_end: periodEnd,
          }),
          "evt_cancel_at_end",
        ),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        hasDrivePlusAccess: true,
      });
    });

    it("immediate cancellation: subscription.deleted downgrades to FREE", async () => {
      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent(
          "customer.subscription.deleted",
          buildStripeSubscription({ status: "canceled" }),
          "evt_immediate_cancel",
        ),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "FREE",
        status: "free",
        hasDrivePlusAccess: false,
      });
    });
  });

  describe("subscription expiration", () => {
    it("canceled subscription past period end revokes Drive+", async () => {
      const pastPeriodEnd = Math.floor(Date.now() / 1000) - 86_400;
      subscriptionsRetrieve.mockResolvedValue(
        buildStripeSubscription({
          status: "canceled",
          current_period_end: pastPeriodEnd,
        }),
      );

      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent(
          "customer.subscription.updated",
          buildStripeSubscription({
            status: "canceled",
            current_period_end: pastPeriodEnd,
          }),
          "evt_expired",
        ),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "FREE",
        status: "free",
        hasDrivePlusAccess: false,
      });
    });
  });

  describe("customer portal", () => {
    it("creates a portal session for linked Stripe customers", async () => {
      const result = await createStripePortalSession({
        stripeCustomerId: STRIPE_TEST_CUSTOMER_ID,
        origin: "http://localhost:5173",
        returnPath: "/settings",
      });

      expect(result.url).toContain("billing.stripe.test");
      expect(portalCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: STRIPE_TEST_CUSTOMER_ID,
          return_url: "http://localhost:5173/settings",
        }),
      );
    });

    it("payment method update does not change entitlements when subscription stays active", async () => {
      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent("customer.subscription.created", buildStripeSubscription()),
      );

      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent(
          "customer.subscription.updated",
          buildStripeSubscription({ status: "active" }),
          "evt_pm_refresh",
        ),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        hasDrivePlusAccess: true,
      });
    });
  });

  describe("webhook delivery", () => {
    it("replay: duplicate event id is idempotent", async () => {
      const event = buildSubscriptionEvent(
        "customer.subscription.updated",
        buildStripeSubscription(),
        "evt_replay_lifecycle",
      );

      const first = await dispatchStripeWebhookEvent(event);
      const second = await dispatchStripeWebhookEvent(event);

      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        hasDrivePlusAccess: true,
      });
    });

    it("out-of-order: cancel-at-period-end then renewal keeps active Drive+", async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 86_400 * 30;

      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent(
          "customer.subscription.updated",
          buildStripeSubscription({
            status: "active",
            cancel_at_period_end: true,
            current_period_end: periodEnd,
          }),
          "evt_ooo_cancel_pending",
        ),
      );

      subscriptionsRetrieve.mockResolvedValue(
        buildStripeSubscription({
          status: "active",
          cancel_at_period_end: false,
          current_period_end: periodEnd + 86_400 * 30,
        }),
      );

      await dispatchStripeWebhookEvent(
        buildInvoiceEvent("invoice.paid", STRIPE_TEST_SUBSCRIPTION_ID, "evt_ooo_renewal"),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "DRIVE_PLUS",
        status: "active",
        hasDrivePlusAccess: true,
      });
    });

    it("out-of-order: immediate delete after active update ends on FREE", async () => {
      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent(
          "customer.subscription.updated",
          buildStripeSubscription({ status: "active" }),
          "evt_ooo_active",
        ),
      );

      await dispatchStripeWebhookEvent(
        buildSubscriptionEvent(
          "customer.subscription.deleted",
          buildStripeSubscription({ status: "canceled" }),
          "evt_ooo_deleted",
        ),
      );

      assertLocalEntitlements(STRIPE_TEST_USER_ID, {
        plan: "FREE",
        status: "free",
        hasDrivePlusAccess: false,
      });
    });
  });
});
