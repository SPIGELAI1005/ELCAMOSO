import { describe, expect, it } from "vitest";

import {
  DRIVE_PLUS_PRICING,
  EARLY_ADOPTER_DISCOUNT_RATE,
  FREE_PLAN_LIST_CENTS,
  formatEuroAmount,
  getDrivePlusMonthlyDisplay,
  getDrivePlusYearlyDisplay,
  getFreePlanDisplay,
  listPriceBeforeEarlyAdopterDiscount,
} from "@/lib/billing/plan-display";

describe("plan display", () => {
  it("formats euro amounts for UI and billing copy", () => {
    expect(formatEuroAmount(0)).toBe("€0");
    expect(formatEuroAmount(DRIVE_PLUS_PRICING.monthly.amountCents)).toBe("€2.99");
    expect(formatEuroAmount(DRIVE_PLUS_PRICING.yearly.amountCents)).toBe("€19.29");
  });

  it("derives list prices from early adopter discounted amounts", () => {
    expect(EARLY_ADOPTER_DISCOUNT_RATE).toBe(0.14);
    expect(listPriceBeforeEarlyAdopterDiscount(DRIVE_PLUS_PRICING.yearly.amountCents)).toBe(2243);
    expect(listPriceBeforeEarlyAdopterDiscount(DRIVE_PLUS_PRICING.monthly.amountCents)).toBe(348);
    expect(FREE_PLAN_LIST_CENTS).toBe(114);
  });

  it("derives yearly equivalent monthly from centralized yearly price", () => {
    const yearly = getDrivePlusYearlyDisplay();
    expect(yearly.amount).toBe("€19.29");
    expect(yearly.listAmount).toBe("€22.43");
    expect(yearly.equivalentMonthly).toBe("€1.61");
    expect(getDrivePlusMonthlyDisplay().amount).toBe("€2.99");
    expect(getDrivePlusMonthlyDisplay().listAmount).toBe("€3.48");
    expect(getFreePlanDisplay().amount).toBe("€0");
    expect(getFreePlanDisplay().listAmount).toBe("€1.14");
  });
});
