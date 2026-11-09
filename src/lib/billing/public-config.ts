import type { LifetimeSeatStatus } from "@/lib/billing/lifetime-seats";
import { COMMERCIAL_PLANS } from "@/lib/billing/stripe/plans";
import type { Plan } from "@/lib/entitlements/types";
import { isBillingAvailable } from "@/lib/billing/billing-available";
import {
  isFoundersPackPriceConfigured,
  isLifetimePriceConfigured,
  isMusicPriceConfigured,
  isUnlimitedPriceConfigured,
  readStripeConfig,
  stripeCheckoutRequirements,
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
  /** True when the monthly Drive the Music price is set, even if yearly is not. */
  musicMonthlyAvailable: boolean;
  /** True when the yearly Drive the Music price is set, even if monthly is not. */
  musicYearlyAvailable: boolean;
  /** Drive Unlimited checkout needs monthly and yearly Price ids. */
  unlimitedAvailable: boolean;
  /** True when the monthly Drive Unlimited price is set, even if yearly is not. */
  unlimitedMonthlyAvailable: boolean;
  /** True when the yearly Drive Unlimited price is set, even if monthly is not. */
  unlimitedYearlyAvailable: boolean;
  /**
   * Founders Pack checkout is available only when STRIPE_PRICE_FOUNDERS_PACK is set.
   * The app does not store a euro amount; the Stripe Price is the source of truth.
   */
  foundersPackAvailable: boolean;
  /** Which Stripe settings the server can see. Values are booleans, never secrets. */
  checkoutRequirements: {
    secretKey: boolean;
    webhookSecret: boolean;
    drivePlusMonthly: boolean;
    drivePlusYearly: boolean;
  };
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
    case "founders_pack":
      // No invented amount — Stripe Price (when configured) is the source of truth.
      return "";
  }
}

export function getBillingPublicConfig(): BillingPublicConfig {
  const yearly = getDrivePlusYearlyDisplay();
  const billing = isBillingAvailable();
  const prices = readStripeConfig().prices;

  return {
    monetizationEnabled: isMonetizationEnabled(),
    available: billing,
    lifetimeAvailable: billing && isLifetimePriceConfigured(),
    musicAvailable: billing && isMusicPriceConfigured(),
    musicMonthlyAvailable: billing && Boolean(prices.drive_music_monthly),
    musicYearlyAvailable: billing && Boolean(prices.drive_music_yearly),
    unlimitedAvailable: billing && isUnlimitedPriceConfigured(),
    unlimitedMonthlyAvailable: billing && Boolean(prices.drive_unlimited_monthly),
    unlimitedYearlyAvailable: billing && Boolean(prices.drive_unlimited_yearly),
    foundersPackAvailable: billing && isFoundersPackPriceConfigured(),
    checkoutRequirements: stripeCheckoutRequirements(),
    freePrice: formatEuroAmount(0),
    yearlyEquivalentMonthly: yearly.equivalentMonthly ?? "",
    plans: COMMERCIAL_PLANS.filter((plan) => plan.id !== "founders_pack").map((plan) => ({
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
