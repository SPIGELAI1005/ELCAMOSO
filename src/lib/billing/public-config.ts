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
  getDriveMusicDisplay,
  getDriveMusicYearlyDisplay,
  getDriveUnlimitedDisplay,
  getDriveUnlimitedYearlyDisplay,
  formatEuroAmount,
  getDrivePlusMonthlyDisplay,
  getDrivePlusYearlyDisplay,
  getDrivePlusLifetimeDisplay,
} from "@/lib/billing/plan-display";
import type { CommercialPlanId } from "@/lib/billing/stripe/plans";

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
  /** Drive the Music checkout needs monthly and yearly Price ids. */
  musicAvailable: boolean;
  /** Drive Unlimited checkout needs monthly and yearly Price ids. */
  unlimitedAvailable: boolean;
  plans: BillingPublicPlan[];
  freePrice: string;
  yearlyEquivalentMonthly: string;
}

function displayPriceForPlan(id: CommercialPlanId): string {
  switch (id) {
    case "drive_plus_monthly":
      return getDrivePlusMonthlyDisplay().amount;
    case "drive_plus_yearly":
      return getDrivePlusYearlyDisplay().amount;
    case "drive_music_monthly":
      return getDriveMusicDisplay("monthly").amount;
    case "drive_music_yearly":
      return getDriveMusicYearlyDisplay().amount;
    case "drive_unlimited_monthly":
      return getDriveUnlimitedDisplay("monthly").amount;
    case "drive_unlimited_yearly":
      return getDriveUnlimitedYearlyDisplay().amount;
    case "drive_plus_lifetime":
      return getDrivePlusLifetimeDisplay().amount;
  }
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
    plans: COMMERCIAL_PLANS.map((plan) => ({
      id: plan.id,
      label: plan.label,
      interval: plan.interval,
      plan: plan.plan,
      displayPrice: displayPriceForPlan(plan.id),
      displayCadence:
        plan.interval === "month" ? "month" : plan.interval === "year" ? "year" : "once",
    })),
  };
}
