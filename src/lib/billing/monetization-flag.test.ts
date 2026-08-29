import { describe, expect, it, afterEach } from "vitest";

import { isBillingAvailable, isBillingManagementAvailable } from "@/lib/billing/billing-available";
import { getBillingPublicConfig } from "@/lib/billing/public-config";
import { isMonetizationEnabled } from "@/lib/billing/monetization-flag";

describe("monetization feature flag", () => {
  const prev = process.env.MONETIZATION_ENABLED;
  const prevStripe = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.MONETIZATION_ENABLED;
    else process.env.MONETIZATION_ENABLED = prev;
    if (prevStripe === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prevStripe;
  });

  it("defaults to disabled when MONETIZATION_ENABLED is unset", () => {
    delete process.env.MONETIZATION_ENABLED;
    expect(isMonetizationEnabled()).toBe(false);
    expect(isBillingAvailable()).toBe(false);
  });

  it("enables billing only when flag and Stripe are both configured", () => {
    process.env.MONETIZATION_ENABLED = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
    expect(isMonetizationEnabled()).toBe(true);
    expect(isBillingAvailable()).toBe(true);
    expect(isBillingManagementAvailable()).toBe(true);
  });

  it("exposes flag state in public billing config", () => {
    delete process.env.MONETIZATION_ENABLED;
    const off = getBillingPublicConfig();
    expect(off.monetizationEnabled).toBe(false);
    expect(off.available).toBe(false);

    process.env.MONETIZATION_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
    const on = getBillingPublicConfig();
    expect(on.monetizationEnabled).toBe(true);
    expect(on.available).toBe(true);
  });
});
