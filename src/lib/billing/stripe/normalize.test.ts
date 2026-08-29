import { describe, expect, it } from "vitest";

import {
  normalizeStripeSubscriptionStatus,
  resolveIntervalFromStripePrice,
} from "@/lib/billing/stripe/normalize";

describe("stripe subscription normalization", () => {
  it("maps Stripe lifecycle states into local billing statuses", () => {
    expect(normalizeStripeSubscriptionStatus("active")).toBe("active");
    expect(normalizeStripeSubscriptionStatus("trialing")).toBe("trialing");
    expect(normalizeStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(normalizeStripeSubscriptionStatus("paused")).toBe("paused");
    expect(normalizeStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(normalizeStripeSubscriptionStatus("incomplete")).toBe("free");
  });

  it("resolves billing interval from configured Stripe price ids", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";

    expect(resolveIntervalFromStripePrice("price_month_test")).toBe("month");
    expect(resolveIntervalFromStripePrice("price_year_test")).toBe("year");
    expect(resolveIntervalFromStripePrice("price_unknown")).toBeNull();
  });
});
