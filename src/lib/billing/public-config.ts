import type { LifetimeSeatStatus } from "@/lib/billing/lifetime-seats";
import { COMMERCIAL_PLANS } from "@/lib/billing/stripe/plans";
import type { Plan } from "@/lib/entitlements/types";
import { isBillingAvailable } from "@/lib/billing/billing-available";
import {
  isLifetimePriceConfigured,
  isMusicPriceConfigured,
  isUnlimitedPriceConfigured,
} from "@/lib/billing/stripe/config";
import { isMonetizationEnabled } from "@/lib/billing/monetization-flag";
import {
  DRIVE_MUSIC_PRICING,
  DRIVE_PLUS_PRICING,
  DRIVE_UNLIMITED_PRICING,
  getDriveMusicYearlyDisplay,
  getDriveUnlimitedYearlyDisplay,
  formatEuroAmount,
  getDrivePlusYearlyDisplay,
  getDrivePlusLifetimeDisplay,
} from "@/lib/billing/plan-display";

/** Client-safe billing catalog - no Stripe secrets or Price ids. */
export interface BillingPublicPlan {
  id: string;
  label: string;
  interval: "month" | "year" | null;
  plan: Plan;
  displayPrice: string;
  displayCadence: string;
}

export interface BillingPublicConfig {
  monetizationEnabled: boolean;
  available: boolean;
  /** Lifetime checkout needs STRIPE_PRICE_DRIVE_PLUS_LIFETIME in addition to billing. */
  lifetimeAvailable: boolean;
  /** Real seat count from completed Lifetime purchases; null/absent when unknown. */
  lifetimeSeats?: LifetimeSeatStatus | null;
  /** Drive the Music checkout needs STRIPE_PRICE_DRIVE_MUSIC_YEARLY. */
  musicAvailable: boolean;
  /** Drive Unlimited checkout needs STRIPE_PRICE_DRIVE_UNLIMITED_YEARLY. */
  unlimitedAvailable: boolean;
  plans: BillingPublicPlan[];
  freePrice: string;
  yearlyEquivalentMonthly: string;
}

export function getBillingPublicConfig(): BillingPublicConfig {
  const yearly = getDrivePlusYearlyDisplay();

  return {
    monetizationEnabled: isMonetizationEnabled(),
    available: isBillingAvailable(),
    lifetimeAvailable: isBillingAvailable() && isLifetimePriceConfigured(),
    musicAvailable: isBillingAvailable() && isMusicPriceConfigured(),
    unlimitedAvailable: isBillingAvailable() && isUnlimitedPriceConfigured(),
    freePrice: formatEuroAmount(0),
    yearlyEquivalentMonthly: yearly.equivalentMonthly ?? "",
    // No separate monthly plan is sold (George, 2 Nov 2026) - yearly packages + Lifetime only.
    plans: COMMERCIAL_PLANS.filter((plan) => plan.interval !== "month").map((plan) => ({
      id: plan.id,
      label: plan.label,
      interval: plan.interval,
      plan: plan.plan,
      displayPrice:
        plan.id === DRIVE_MUSIC_PRICING.yearly.commercialPlanId
          ? getDriveMusicYearlyDisplay().amount
          : plan.id === DRIVE_UNLIMITED_PRICING.yearly.commercialPlanId
            ? getDriveUnlimitedYearlyDisplay().amount
            : plan.id === DRIVE_PLUS_PRICING.lifetime.commercialPlanId
            ? getDrivePlusLifetimeDisplay().amount
            : yearly.amount,
      displayCadence:
        plan.interval === "month" ? "month" : plan.interval === "year" ? "year" : "once",
    })),
  };
}
