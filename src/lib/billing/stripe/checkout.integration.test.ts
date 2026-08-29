import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import { resetStripeClientForTests } from "@/lib/billing/stripe/client";
import { isStripeConfigured, readStripeConfig } from "@/lib/billing/stripe/config";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";

const canRunLiveStripe =
  process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true &&
  Boolean(process.env.STRIPE_WEBHOOK_SECRET) &&
  Boolean(process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY) &&
  Boolean(process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY);

const live = canRunLiveStripe ? describe : describe.skip;

live("stripe checkout integration (test mode)", () => {
  const userId = "22222222-2222-4222-8222-222222222222";
  const email = `checkout-test+${Date.now()}@example.com`;

  beforeEach(() => {
    resetUserBillingRepositoryForTests();
    resetStripeClientForTests();
  });

  afterEach(() => {
    resetStripeClientForTests();
  });

  it("is configured with test-mode keys and mapped prices", () => {
    expect(isStripeConfigured()).toBe(true);
    const config = readStripeConfig();
    expect(config.prices.drive_plus_monthly.startsWith("price_")).toBe(true);
    expect(config.prices.drive_plus_yearly.startsWith("price_")).toBe(true);
  });

  it("creates monthly and yearly Checkout Sessions in Stripe test mode", async () => {
    const monthly = await beginDrivePlusCheckout({
      userId,
      email,
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "monthly", source: "integration_test" },
    });
    expect(monthly.action).toBe("checkout");
    if (monthly.action === "checkout") {
      expect(monthly.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      expect(monthly.sessionId.startsWith("cs_")).toBe(true);
    }

    const yearly = await beginDrivePlusCheckout({
      userId: `${userId}-yearly`,
      email: `yearly+${Date.now()}@example.com`,
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "yearly", source: "integration_test" },
    });
    expect(yearly.action).toBe("checkout");
    if (yearly.action === "checkout") {
      expect(yearly.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      expect(yearly.sessionId.startsWith("cs_")).toBe(true);
    }

    const storedCustomer = await memoryUserBillingRepository.getStripeCustomerId(userId);
    expect(storedCustomer?.startsWith("cus_")).toBe(true);
  });
});
