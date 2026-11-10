import { describe, expect, it } from "vitest";

import {
  FOUNDERS_PRICING_HASH,
  FOUNDERS_PRICING_SEARCH,
  parsePricingBillingParam,
  parsePricingFromParam,
  pricingDisplayIntervalFromSearch,
} from "@/lib/billing/pricing-search";

describe("pricing display interval from search", () => {
  it("defaults to monthly when the billing param is missing or invalid", () => {
    expect(pricingDisplayIntervalFromSearch(undefined)).toBe("monthly");
    expect(pricingDisplayIntervalFromSearch(null)).toBe("monthly");
    expect(pricingDisplayIntervalFromSearch("")).toBe("monthly");
    expect(pricingDisplayIntervalFromSearch("year")).toBe("monthly");
    expect(pricingDisplayIntervalFromSearch("YEARLY")).toBe("monthly");
    expect(parsePricingBillingParam("lifetime")).toBeUndefined();
  });

  it("accepts yearly and monthly from the URL", () => {
    expect(parsePricingBillingParam("yearly")).toBe("yearly");
    expect(parsePricingBillingParam("monthly")).toBe("monthly");
    expect(pricingDisplayIntervalFromSearch("yearly")).toBe("yearly");
    expect(pricingDisplayIntervalFromSearch("monthly")).toBe("monthly");
  });

  it("recognises the Founders Pack entry and keeps that search on the CTA", () => {
    expect(parsePricingFromParam("founders")).toBe("founders");
    expect(parsePricingFromParam("banner")).toBeUndefined();
    expect(FOUNDERS_PRICING_SEARCH).toEqual({ billing: "yearly", from: "founders" });
    expect(FOUNDERS_PRICING_HASH).toBe("founders");
  });
});
