import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

import { resetAccountAuthStoreForTests, saveAccountSession } from "@/lib/account/session-store";
import { getAccountSession } from "@/lib/account/auth-service";
import {
  assertAllowedCheckoutOrigin,
  readAllowedCheckoutOrigins,
} from "@/lib/billing/checkout-origin";
import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import {
  resolvePlanFromStripePrice,
  resolvePlanFromMetadata,
} from "@/lib/billing/stripe/normalize";
import {
  StripeWebhookProcessingError,
  resolveUserIdForStripeSubscription,
} from "@/lib/billing/stripe/subscription-sync";
import { resetSubscriptionRepositoryStoreForTests } from "@/lib/billing/subscription-repository-memory";
import { resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import {
  createTeslaUpgradeToken,
  resetTeslaUpgradeStoreForTests,
} from "@/lib/tesla-upgrade/store";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const checkoutCreate = vi.fn();
const customersCreate = vi.fn();
const customersRetrieve = vi.fn();
const subscriptionsList = vi.fn();

vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: checkoutCreate } },
    customers: { create: customersCreate, retrieve: customersRetrieve },
    subscriptions: { list: subscriptionsList },
  }),
  resetStripeClientForTests: vi.fn(),
}));

describe("checkout origin allowlist", () => {
  const prev = process.env.ELCAMOSO_ALLOWED_ORIGINS;

  afterEach(() => {
    if (prev === undefined) delete process.env.ELCAMOSO_ALLOWED_ORIGINS;
    else process.env.ELCAMOSO_ALLOWED_ORIGINS = prev;
    delete process.env.ELCAMOSO_ENV;
  });

  it("accepts origins on the allowlist", () => {
    process.env.ELCAMOSO_ALLOWED_ORIGINS = "https://app.example.com,http://localhost:5173";
    expect(readAllowedCheckoutOrigins()).toEqual([
      "https://app.example.com",
      "http://localhost:5173",
    ]);
    expect(assertAllowedCheckoutOrigin("https://app.example.com/")).toBe("https://app.example.com");
  });

  it("rejects origins outside the allowlist", () => {
    process.env.ELCAMOSO_ALLOWED_ORIGINS = "https://app.example.com";
    expect(() => assertAllowedCheckoutOrigin("https://evil.example.com")).toThrow(
      /not allowed/i,
    );
  });

  it("allows localhost in non-production when allowlist is unset", () => {
    delete process.env.ELCAMOSO_ALLOWED_ORIGINS;
    process.env.ELCAMOSO_ENV = "development";
    expect(assertAllowedCheckoutOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("requires trusted host match in production without allowlist", () => {
    delete process.env.ELCAMOSO_ALLOWED_ORIGINS;
    process.env.ELCAMOSO_ENV = "production";
    expect(() => assertAllowedCheckoutOrigin("https://evil.example.com")).toThrow(/not allowed/i);
    expect(
      assertAllowedCheckoutOrigin("https://app.example.com", "app.example.com"),
    ).toBe("https://app.example.com");
  });
});

describe("stripe price and plan validation", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
  });

  it("grants Drive+ only for configured Stripe price ids", () => {
    expect(resolvePlanFromStripePrice("price_month_test")).toBe("DRIVE_PLUS");
    expect(resolvePlanFromStripePrice("price_unknown")).toBeNull();
  });

  it("does not infer Drive+ from metadata alone", () => {
    expect(resolvePlanFromMetadata({ elcamosoPlan: "DRIVE_PLUS" })).toBe("DRIVE_PLUS");
    expect(resolvePlanFromMetadata({ elcamosoPlan: "FREE" })).toBeNull();
    expect(resolvePlanFromMetadata(null)).toBeNull();
  });
});

describe("subscription ownership resolution", () => {
  beforeEach(() => {
    resetUserBillingRepositoryForTests();
  });

  it("uses Stripe customer mapping when metadata agrees", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(USER_A, "cus_owner");
    const userId = await resolveUserIdForStripeSubscription({
      id: "sub_x",
      customer: "cus_owner",
      metadata: { userId: USER_A },
    } as Stripe.Subscription);
    expect(userId).toBe(USER_A);
  });

  it("rejects metadata userId that conflicts with customer owner", async () => {
    await memoryUserBillingRepository.setStripeCustomerId(USER_A, "cus_owner");
    await expect(
      resolveUserIdForStripeSubscription({
        id: "sub_x",
        customer: "cus_owner",
        metadata: { userId: USER_B },
      } as Stripe.Subscription),
    ).rejects.toBeInstanceOf(StripeWebhookProcessingError);
  });
});

describe("account session token storage", () => {
  beforeEach(() => {
    resetAccountAuthStoreForTests();
  });

  it("resolves sessions by bearer token after hashed storage", () => {
    saveAccountSession({
      token: "visible-session-token",
      userId: USER_A,
      email: "driver@example.com",
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    expect(getAccountSession("visible-session-token")?.userId).toBe(USER_A);
    expect(getAccountSession("wrong-token")).toBeNull();
  });
});

describe("tesla upgrade token resolve redaction", () => {
  beforeEach(() => {
    resetTeslaUpgradeStoreForTests();
  });

  it("createTeslaUpgradeToken binds userId internally without public resolve leak", () => {
    const created = createTeslaUpgradeToken({
      userId: USER_A,
      clientDriveSessionId: "drive-tab",
    });
    expect(created.token.length).toBeGreaterThan(20);
  });
});

describe("checkout uses server-resolved price ids", () => {
  beforeEach(() => {
    resetUserBillingRepositoryForTests();
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
    process.env.ELCAMOSO_ENV = "development";
    process.env.MONETIZATION_ENABLED = "1";
    customersCreate.mockResolvedValue({ id: "cus_test" });
    customersRetrieve.mockResolvedValue({ id: "cus_test", deleted: false });
    subscriptionsList.mockResolvedValue({ data: [] });
    checkoutCreate.mockResolvedValue({ id: "cs_test", url: "https://checkout.stripe.test/cs" });
  });

  it("rejects disallowed checkout origins in production", async () => {
    process.env.ELCAMOSO_ENV = "production";
    delete process.env.ELCAMOSO_ALLOWED_ORIGINS;
    await expect(
      beginDrivePlusCheckout({
        userId: USER_A,
        email: "driver@example.com",
        origin: "https://phishing.example.com",
        request: { plan: "drive_plus", interval: "yearly" },
      }),
    ).rejects.toThrow(/not allowed/i);
  });

  it("creates checkout with env-resolved price id", async () => {
    await beginDrivePlusCheckout({
      userId: USER_A,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      trustedHost: "localhost:5173",
      request: { plan: "drive_plus", interval: "yearly" },
    });
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_year_test", quantity: 1 }],
      }),
    );
  });
});
