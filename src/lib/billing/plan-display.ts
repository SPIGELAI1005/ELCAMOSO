import type { CommercialPlanId } from "@/lib/billing/stripe/plans";

/** Early adopter discount applied to displayed list prices (14%). */
export const EARLY_ADOPTER_DISCOUNT_RATE = 0.14;

/** Anchor list price for Free - shown struck through for early adopters. */
export const FREE_PLAN_LIST_CENTS = 114;

/** Display amounts - keep in sync with Stripe Price configuration in the Dashboard. */
export const DRIVE_PLUS_PRICING = {
  currency: "EUR",
  monthly: {
    commercialPlanId: "drive_plus_monthly" satisfies CommercialPlanId,
    /** Charged monthly price after early adopter discount. */
    amountCents: 299,
  },
  yearly: {
    commercialPlanId: "drive_plus_yearly" satisfies CommercialPlanId,
    /** Charged annual price after early adopter discount. */
    amountCents: 2499,
  },
} as const;

export type BillingDisplayInterval = "monthly" | "yearly";

export const FREE_PLAN_FEATURES = [
  "Essential Engine profiles",
  "Tesla or browser Drive with phone pairing",
  "Cinematic Rock Symphony experience",
  "Space Drive Worlds sampler",
  "Drive DNA and local Journey history",
  "One basic Drive Song with sharing",
] as const;

/** Shipped Drive+ capabilities - omit speculative or unreleased entitlements. */
export const DRIVE_PLUS_FEATURES = [
  "Every Engine personality",
  "All Symphony packs and Worlds",
  "Fusion: machine meets music",
  "Full Drive Songs and multiple remixes",
  "Full Journey history and Drive Reel",
  "Sound, Symphony, and Fusion Studio",
  "Premium presets and future Experience Drops",
] as const;

export interface PlanPriceDisplay {
  amount: string;
  listAmount: string;
  cadence: string;
  equivalentMonthly?: string;
}

export function formatEuroAmount(cents: number): string {
  const value = cents / 100;
  const decimals = Number.isInteger(value) ? 0 : 2;
  return `€${value.toFixed(decimals)}`;
}

/** List price before the early adopter discount is applied. */
export function listPriceBeforeEarlyAdopterDiscount(discountedCents: number): number {
  return Math.round(discountedCents / (1 - EARLY_ADOPTER_DISCOUNT_RATE));
}

export function getFreePlanDisplay(): { amount: string; listAmount: string } {
  return {
    amount: formatEuroAmount(0),
    listAmount: formatEuroAmount(FREE_PLAN_LIST_CENTS),
  };
}

export function getDrivePlusMonthlyDisplay(): PlanPriceDisplay {
  const amountCents = DRIVE_PLUS_PRICING.monthly.amountCents;
  return {
    amount: formatEuroAmount(amountCents),
    listAmount: formatEuroAmount(listPriceBeforeEarlyAdopterDiscount(amountCents)),
    cadence: "month",
  };
}

export function getDrivePlusYearlyDisplay(): PlanPriceDisplay {
  const amountCents = DRIVE_PLUS_PRICING.yearly.amountCents;
  const equivalentCents = Math.round(amountCents / 12);
  return {
    amount: formatEuroAmount(amountCents),
    listAmount: formatEuroAmount(listPriceBeforeEarlyAdopterDiscount(amountCents)),
    cadence: "year",
    equivalentMonthly: formatEuroAmount(equivalentCents),
  };
}

export function getDrivePlusDisplay(interval: BillingDisplayInterval): PlanPriceDisplay {
  return interval === "monthly" ? getDrivePlusMonthlyDisplay() : getDrivePlusYearlyDisplay();
}
