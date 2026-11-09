import { describe, expect, it } from "vitest";

import {
  parseCheckoutIntervalSlug,
  parseCheckoutPlanRequest,
  parseCheckoutPlanSlug,
  resolveCommercialPlanId,
} from "@/lib/billing/checkout-request";

describe("checkout plan request", () => {
  it("parses drive_plus with monthly or yearly intervals", () => {
    expect(parseCheckoutPlanSlug("drive_plus")).toBe("drive_plus");
    expect(parseCheckoutIntervalSlug("monthly")).toBe("monthly");
    expect(parseCheckoutIntervalSlug("yearly")).toBe("yearly");
    expect(resolveCommercialPlanId("drive_plus", "monthly")).toBe("drive_plus_monthly");
    expect(resolveCommercialPlanId("drive_plus", "yearly")).toBe("drive_plus_yearly");
    expect(resolveCommercialPlanId("drive_music", "monthly")).toBe("drive_music_monthly");
    expect(resolveCommercialPlanId("drive_music", "yearly")).toBe("drive_music_yearly");
    expect(resolveCommercialPlanId("drive_unlimited", "monthly")).toBe("drive_unlimited_monthly");
    expect(resolveCommercialPlanId("drive_unlimited", "yearly")).toBe("drive_unlimited_yearly");
    expect(resolveCommercialPlanId("founders", "lifetime")).toBe("founders_pack");
  });

  it("rejects Stripe price ids and unknown plans in request bodies", () => {
    expect(parseCheckoutPlanRequest({ plan: "price_123", interval: "monthly" })).toBeNull();
    expect(parseCheckoutPlanRequest({ plan: "drive_plus", interval: "weekly" })).toBeNull();
    expect(parseCheckoutPlanRequest(null)).toBeNull();
  });

  it("accepts optional returnPath and source", () => {
    expect(
      parseCheckoutPlanRequest({
        plan: "drive_plus",
        interval: "yearly",
        returnPath: "/settings",
        source: "settings_cta",
      }),
    ).toEqual({
      plan: "drive_plus",
      interval: "yearly",
      returnPath: "/settings",
      source: "settings_cta",
    });
  });
});
