import { describe, expect, it } from "vitest";

import {
  BILLING_INTERVALS,
  BILLING_STATUSES,
  isPaidBillingStatus,
  parseBillingInterval,
  parseBillingStatus,
  parseSubscriptionProvider,
} from "@/lib/billing/status";

describe("billing status", () => {
  it("includes normalized lifecycle values", () => {
    expect(BILLING_STATUSES).toEqual([
      "free",
      "trialing",
      "active",
      "past_due",
      "paused",
      "canceled",
    ]);
  });

  it("parses known statuses and rejects unknown", () => {
    expect(parseBillingStatus("active")).toBe("active");
    expect(parseBillingStatus("incomplete")).toBeNull();
  });

  it("identifies paid access states", () => {
    expect(isPaidBillingStatus("trialing")).toBe(true);
    expect(isPaidBillingStatus("active")).toBe(true);
    expect(isPaidBillingStatus("past_due")).toBe(true);
    expect(isPaidBillingStatus("free")).toBe(false);
    expect(isPaidBillingStatus("canceled")).toBe(false);
    expect(isPaidBillingStatus("paused")).toBe(false);
  });

  it("parses provider and interval enums", () => {
    expect(parseSubscriptionProvider("stripe")).toBe("stripe");
    expect(parseSubscriptionProvider("paypal")).toBeNull();
    expect(BILLING_INTERVALS).toEqual(["month", "year"]);
    expect(parseBillingInterval("year")).toBe("year");
    expect(parseBillingInterval("week")).toBeNull();
  });
});
