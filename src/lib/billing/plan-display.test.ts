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
  getDriveMusicDisplay,
  getDrivePlusDisplay,
} from "@/lib/billing/plan-display";

describe("plan display", () => {
  it("formats euro amounts for UI and billing copy", () => {
    expect(formatEuroAmount(0)).toBe("€0");
    expect(formatEuroAmount(DRIVE_PLUS_PRICING.monthly.amountCents)).toBe("€2.99");
    expect(formatEuroAmount(DRIVE_PLUS_PRICING.yearly.amountCents)).toBe("€19.89");
  });

  it("derives list prices from early adopter discounted amounts", () => {
    expect(EARLY_ADOPTER_DISCOUNT_RATE).toBe(0.14);
    expect(listPriceBeforeEarlyAdopterDiscount(DRIVE_PLUS_PRICING.yearly.amountCents)).toBe(2313);
    expect(listPriceBeforeEarlyAdopterDiscount(DRIVE_PLUS_PRICING.monthly.amountCents)).toBe(348);
    expect(FREE_PLAN_LIST_CENTS).toBe(114);
  });

  it("derives yearly equivalent monthly from centralized yearly price", () => {
    const yearly = getDrivePlusYearlyDisplay();
    expect(yearly.amount).toBe("€19.89");
    expect(yearly.listAmount).toBe("€23.13");
    expect(yearly.equivalentMonthly).toBe("€1.66");
    expect(getDrivePlusMonthlyDisplay().amount).toBe("€2.99");
    expect(getDrivePlusMonthlyDisplay().listAmount).toBe("€3.48");
    expect(getFreePlanDisplay().amount).toBe("€0");
    expect(getFreePlanDisplay().listAmount).toBe("€1.14");
  });

  it("monthly toggle shows the yearly price per month, billed yearly", () => {
    const m = getDrivePlusDisplay("monthly");
    expect(m.amount).toBe("€1.66");
    expect(m.listAmount).toBe("€1.93");
    expect(getDriveMusicDisplay("monthly")).toEqual(m);
    expect(getDriveMusicDisplay("yearly").listAmount).toBe("€23.13");
  });
});
