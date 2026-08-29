import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveAccountSession } from "@/lib/account/session-store";
import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import { setSubscriptionForUser, resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import { resetStripeClientForTests } from "@/lib/billing/stripe/client";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";

const ENV_KEYS = [
  "MONETIZATION_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_DRIVE_PLUS_MONTHLY",
  "STRIPE_PRICE_DRIVE_PLUS_YEARLY",
  "STRIPE_CHECKOUT_AUTOMATIC_TAX",
  "STRIPE_CHECKOUT_BILLING_ADDRESS_COLLECTION",
  "STRIPE_CHECKOUT_TAX_ID_COLLECTION",
  "STRIPE_CHECKOUT_CUSTOMER_UPDATE",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const customersCreate = vi.fn();
const customersRetrieve = vi.fn();
const checkoutCreate = vi.fn();
const subscriptionsList = vi.fn();
const portalCreate = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    customers: {
      create: customersCreate,
      retrieve: customersRetrieve,
    },
    checkout: {
      sessions: {
        create: checkoutCreate,
      },
    },
    subscriptions: {
      list: subscriptionsList,
    },
    billingPortal: {
      sessions: {
        create: portalCreate,
      },
    },
  }),
  resetStripeClientForTests: vi.fn(),
}));

describe("beginDrivePlusCheckout", () => {
  const previousEnv = snapshotEnv();
  const userId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    resetUserBillingRepositoryForTests();
    resetSubscriptionStoreForTests();
    resetStripeClientForTests();
    process.env.MONETIZATION_ENABLED = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";

    customersCreate.mockResolvedValue({ id: "cus_new" });
    customersRetrieve.mockResolvedValue({ id: "cus_existing", deleted: false });
    checkoutCreate.mockResolvedValue({
      id: "cs_test_monthly",
      url: "https://checkout.stripe.test/cs_test_monthly",
    });
    subscriptionsList.mockResolvedValue({ data: [] });
    portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/portal" });
  });

  afterEach(() => {
    restoreEnv(previousEnv);
    vi.clearAllMocks();
  });

  it("creates a monthly subscription checkout session for a new customer", async () => {
    const result = await beginDrivePlusCheckout({
      userId,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "monthly", source: "settings" },
    });

    expect(result.action).toBe("checkout");
    if (result.action !== "checkout") return;

    expect(result.url).toContain("checkout.stripe.test");
    expect(customersCreate).toHaveBeenCalledWith({
      email: "driver@example.com",
      metadata: { userId },
    });
    expect(await memoryUserBillingRepository.getStripeCustomerId(userId)).toBe("cus_new");
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_new",
        line_items: [{ price: "price_month_test", quantity: 1 }],
        metadata: expect.objectContaining({
          userId,
          plan: "drive_plus",
          interval: "monthly",
          source: "settings",
        }),
      }),
    );
  });

  it("creates a yearly subscription checkout session using the yearly price", async () => {
    checkoutCreate.mockResolvedValue({
      id: "cs_test_yearly",
      url: "https://checkout.stripe.test/cs_test_yearly",
    });

    const result = await beginDrivePlusCheckout({
      userId,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "yearly" },
    });

    expect(result.action).toBe("checkout");
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_year_test", quantity: 1 }],
        metadata: expect.objectContaining({ interval: "yearly" }),
      }),
    );
  });

  it("reuses an existing Stripe customer without creating a duplicate", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(userId, "cus_existing");

    await beginDrivePlusCheckout({
      userId,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "monthly" },
    });

    expect(customersCreate).not.toHaveBeenCalled();
    expect(customersRetrieve).toHaveBeenCalledWith("cus_existing");
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });

  it("redirects active Drive+ subscribers to manage subscription instead of checkout", async () => {
    setSubscriptionForUser({
      userId,
      plan: "DRIVE_PLUS",
      status: "active",
      interval: "month",
    });
    await memoryUserBillingRepository.setStripeCustomerId(userId, "cus_existing");

    const result = await beginDrivePlusCheckout({
      userId,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "monthly" },
    });

    expect(result.action).toBe("manage");
    expect(result.url).toContain("billing.stripe.test");
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(portalCreate).toHaveBeenCalled();
  });

  it("does not grant entitlements during checkout", async () => {
    saveAccountSession({
      token: "session-token",
      userId,
      email: "driver@example.com",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });

    await beginDrivePlusCheckout({
      userId,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "monthly" },
    });

    const { getSubscriptionForUser } = await import("@/lib/billing/subscription-store");
    expect(getSubscriptionForUser(userId)).toBeNull();
  });

  it("merges configured checkout tax params without assuming tax rates", async () => {
    process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = "true";
    process.env.STRIPE_CHECKOUT_BILLING_ADDRESS_COLLECTION = "auto";
    process.env.STRIPE_CHECKOUT_TAX_ID_COLLECTION = "true";

    await beginDrivePlusCheckout({
      userId,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "monthly" },
    });

    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: { enabled: true },
        billing_address_collection: "auto",
        tax_id_collection: { enabled: true },
        customer_update: { address: "auto", name: "auto" },
      }),
    );
  });
});
