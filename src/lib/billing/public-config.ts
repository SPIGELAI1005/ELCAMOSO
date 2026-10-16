import { COMMERCIAL_PLANS } from "@/lib/billing/stripe/plans";
import { isBillingAvailable } from "@/lib/billing/billing-available";
import { isLifetimePriceConfigured } from "@/lib/billing/stripe/config";
import { isMonetizationEnabled } from "@/lib/billing/monetization-flag";
import {
  DRIVE_PLUS_PRICING,
  formatEuroAmount,
  getDrivePlusMonthlyDisplay,
  getDrivePlusYearlyDisplay,
  getDrivePlusLifetimeDisplay,
} from "@/lib/billing/plan-display";

/** Client-safe billing catalog - no Stripe secrets or Price ids. */
export interface BillingPublicPlan {
  id: string;
  label: string;
  interval: "month" | "year" | null;
  plan: "DRIVE_PLUS";
  displayPrice: string;
  displayCadence: string;
}

export interface BillingPublicConfig {
  monetizationEnabled: boolean;
  available: boolean;
  /** Lifetime checkout needs STRIPE_PRICE_DRIVE_PLUS_LIFETIME in addition to billing. */
  lifetimeAvailable: boolean;
  plans: BillingPublicPlan[];
  freePrice: string;
  yearlyEquivalentMonthly: string;
}

export function getBillingPublicConfig(): BillingPublicConfig {
  const yearly = getDrivePlusYearlyDisplay();
  const monthly = getDrivePlusMonthlyDisplay();

  return {
    monetizationEnabled: isMonetizationEnabled(),
    available: isBillingAvailable(),
    lifetimeAvailable: isBillingAvailable() && isLifetimePriceConfigured(),
    freePrice: formatEuroAmount(0),
    yearlyEquivalentMonthly: yearly.equivalentMonthly ?? "",
    plans: COMMERCIAL_PLANS.map((plan) => ({
      id: plan.id,
      label: plan.label,
      interval: plan.interval,
      plan: "DRIVE_PLUS" as const,
      displayPrice:
        plan.id === DRIVE_PLUS_PRICING.monthly.commercialPlanId
          ? monthly.amount
          : plan.id === DRIVE_PLUS_PRICING.lifetime.commercialPlanId
            ? getDrivePlusLifetimeDisplay().amount
            : yearly.amount,
      displayCadence:
        plan.interval === "month" ? "month" : plan.interval === "year" ? "year" : "once",
    })),
  };
}
