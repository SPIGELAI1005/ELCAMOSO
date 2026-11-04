import { describe, expect, it } from "vitest";

import {
  DRIVE_PLUS_PRICING,
  EARLY_ADOPTER_DISCOUNT_RATE,
  FREE_PLAN_LIST_CENTS,
  formatEuroAmount,
  getDrivePlusLifetimeDisplay,
  getDrivePlusMonthlyDisplay,
  getDrivePlusYearlyDisplay,
  getDriveUnlimitedDisplay,
  getFreePlanDisplay,
  getDriveMusicDisplay,
  getDrivePlusDisplay,
} from "@/lib/billing/plan-display";
import { resolveCommercialPlanId } from "@/lib/billing/checkout-request";
import { getCommercialPlan } from "@/lib/billing/stripe/plans";

describe("plan display", () => {
  it("formats euro amounts for UI and billing copy", () => {
    expect(formatEuroAmount(0)).toBe("€0");
    expect(formatEuroAmount(DRIVE_PLUS_PRICING.monthly.amountCents)).toBe("€2.80");
    expect(formatEuroAmount(DRIVE_PLUS_PRICING.yearly.amountCents)).toBe("€33.60");
  });

  it("keeps the early adopter rate for Free and Lifetime", () => {
    expect(EARLY_ADOPTER_DISCOUNT_RATE).toBe(0.14);
    expect(FREE_PLAN_LIST_CENTS).toBe(114);
    expect(getDrivePlusLifetimeDisplay().amount).toBe("€59.67");
    expect(getDrivePlusLifetimeDisplay().listAmount).toBe("€69.38");
  });

  it("yearly = monthly × 12 with explicit full prices", () => {
    const yearly = getDrivePlusYearlyDisplay();
    expect(yearly.amount).toBe("€33.60");
    expect(yearly.listAmount).toBe("€39.48");
    expect(yearly.equivalentMonthly).toBe("€2.80");
    expect(yearly.badge).toBe("-15%");
    expect(getDrivePlusMonthlyDisplay().amount).toBe("€2.80");
    expect(getDrivePlusMonthlyDisplay().listAmount).toBe("€3.29");
    expect(getFreePlanDisplay().amount).toBe("€0");
    expect(getFreePlanDisplay().listAmount).toBe("€1.14");
  });

  it("monthly toggle shows the yearly price per month, billed yearly", () => {
    const m = getDrivePlusDisplay("monthly");
    expect(m.amount).toBe("€2.80");
    expect(m.listAmount).toBe("€3.29");
    expect(getDriveMusicDisplay("monthly")).toEqual(m);
    expect(getDriveMusicDisplay("yearly").listAmount).toBe("€39.48");
  });

  it("Drive Unlimited: €4.90 (full €6.58) per month, €58.80 (full €78.96) per year", () => {
    const m = getDriveUnlimitedDisplay("monthly");
    expect(m.amount).toBe("€4.90");
    expect(m.listAmount).toBe("€6.58");
    const y = getDriveUnlimitedDisplay("yearly");
    expect(y.amount).toBe("€58.80");
    expect(y.listAmount).toBe("€78.96");
    expect(y.badge).toBe("-26%");
  });

  it("Drive Unlimited checkout grants both packages", () => {
    const id = resolveCommercialPlanId("drive_unlimited", "yearly");
    expect(id).toBe("drive_unlimited_yearly");
    expect(getCommercialPlan(id!).plan).toBe("DRIVE_COMPLETE");
    expect(resolveCommercialPlanId("drive_unlimited", "monthly")).toBeNull();
  });
});
