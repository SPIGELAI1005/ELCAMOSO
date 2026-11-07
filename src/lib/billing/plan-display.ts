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
    amountCents: 280,
    /** Full (struck-through) monthly price (George, 4 Nov 2026). */
    listAmountCents: 329,
  },
  yearly: {
    commercialPlanId: "drive_plus_yearly" satisfies CommercialPlanId,
    /** Charged annual price = €2.80 × 12 (George, 4 Nov 2026). */
    amountCents: 3360,
    /** Full (struck-through) annual price = €3.29 × 12. */
    listAmountCents: 3948,
  },
  lifetime: {
    commercialPlanId: "drive_plus_lifetime" satisfies CommercialPlanId,
    /** One-time Lifetime price (Drive+ AND Drive the Music) after early adopter discount. */
    amountCents: 5967,
  },
} as const;

/** "Drive the Music" package - same monthly and yearly prices as Drive+. */
export const DRIVE_MUSIC_PRICING = {
  currency: "EUR",
  monthly: {
    commercialPlanId: "drive_music_monthly" satisfies CommercialPlanId,
    /** Charged monthly price after early adopter discount. */
    amountCents: 280,
    /** Full (struck-through) monthly price. */
    listAmountCents: 329,
  },
  yearly: {
    commercialPlanId: "drive_music_yearly" satisfies CommercialPlanId,
    /** Charged annual price = €2.80 × 12 (George, 4 Nov 2026). */
    amountCents: 3360,
    /** Full (struck-through) annual price = €3.29 × 12. */
    listAmountCents: 3948,
  },
} as const;

/** "Drive Unlimited" package - Drive+ AND Drive the Music together. */
export const DRIVE_UNLIMITED_PRICING = {
  currency: "EUR",
  monthly: {
    commercialPlanId: "drive_unlimited_monthly" satisfies CommercialPlanId,
    /** Charged monthly price = €4.99. */
    amountCents: 499,
    /** Full (struck-through) monthly price = €3.29 + €3.29. */
    listAmountCents: 658,
  },
  yearly: {
    commercialPlanId: "drive_unlimited_yearly" satisfies CommercialPlanId,
    /** Charged annual price = €4.99 × 12. */
    amountCents: 5988,
    /** Full (struck-through) annual price = (€3.29 + €3.29) × 12. */
    listAmountCents: 7896,
  },
} as const;

export type BillingDisplayInterval = "monthly" | "yearly";

export const FREE_PLAN_FEATURES = [
  "Essential Engine profiles",
  "Tesla or browser Drive with phone pairing",
  "Latino Fiesta experience",
  "Dracula Carriage",
  "Racing V10 Engine Sound",
  "American Muscle V8 Engine Sound",
  "Drive DNA and local Journey history",
] as const;

/** Shipped Drive+ (engine package) capabilities - omit speculative or unreleased entitlements. */
export const DRIVE_PLUS_FEATURES = [
  "Every Engine personality",
  "Dynamic Drive: rev match and shift feel",
  "All Worlds",
  "Full Drive Songs and multiple remixes",
  "Full Journey history and Drive Reel",
  "Premium presets and future Experience Drops",
] as const;

/** Shipped "Drive the Music" package capabilities. */
export const DRIVE_MUSIC_FEATURES = [
  "Every music profile and Symphony genre",
  "Auto DJ: a new genre every few minutes, on the beat",
  "Highway stages from 90 to 220 km/h",
  "Fusion: machine meets music",
  "Symphony and Fusion Studio",
] as const;

/** Shipped "Drive Unlimited" capabilities: both packages. */
export const DRIVE_UNLIMITED_FEATURES = [
  "Everything in Drive+",
  "Everything in Drive the Music",
  "One subscription for both packages",
] as const;

export interface PlanPriceDisplay {
  amount: string;
  listAmount: string;
  /** Rounded discount vs. the struck-through price, e.g. "-15%". */
  badge?: string;
  cadence: string;
  equivalentMonthly?: string;
}

export function formatEuroAmount(cents: number): string {
  const value = cents / 100;
  const decimals = cents === 0 ? 0 : 2;
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
  const { amountCents, listAmountCents } = DRIVE_PLUS_PRICING.monthly;
  return {
    amount: formatEuroAmount(amountCents),
    listAmount: formatEuroAmount(listAmountCents),
    badge: discountBadge(amountCents, listAmountCents),
    cadence: "month",
  };
}

export function getDrivePlusYearlyDisplay(): PlanPriceDisplay {
  const { amountCents, listAmountCents } = DRIVE_PLUS_PRICING.yearly;
  return yearlyDisplay(amountCents, listAmountCents);
}

function monthlyDisplay(amountCents: number, listCents: number): PlanPriceDisplay {
  return {
    amount: formatEuroAmount(amountCents),
    listAmount: formatEuroAmount(listCents),
    badge: discountBadge(amountCents, listCents),
    cadence: "month",
  };
}

/** "-15%" style badge from charged vs. full price. */
export function discountBadge(amountCents: number, listCents: number): string {
  return `-${Math.round((1 - amountCents / listCents) * 100)}%`;
}

function yearlyDisplay(amountCents: number, listCents: number): PlanPriceDisplay {
  return {
    amount: formatEuroAmount(amountCents),
    listAmount: formatEuroAmount(listCents),
    badge: discountBadge(amountCents, listCents),
    cadence: "year",
    equivalentMonthly: formatEuroAmount(Math.round(amountCents / 12)),
  };
}

export function getDriveUnlimitedYearlyDisplay(): PlanPriceDisplay {
  const { amountCents, listAmountCents } = DRIVE_UNLIMITED_PRICING.yearly;
  return yearlyDisplay(amountCents, listAmountCents);
}

export function getDriveUnlimitedDisplay(interval: BillingDisplayInterval): PlanPriceDisplay {
  if (interval === "monthly") {
    const { amountCents, listAmountCents } = DRIVE_UNLIMITED_PRICING.monthly;
    return monthlyDisplay(amountCents, listAmountCents);
  }
  return getDriveUnlimitedYearlyDisplay();
}

export function getDrivePlusDisplay(interval: BillingDisplayInterval): PlanPriceDisplay {
  return interval === "monthly" ? getDrivePlusMonthlyDisplay() : getDrivePlusYearlyDisplay();
}

export function getDriveMusicDisplay(interval: BillingDisplayInterval): PlanPriceDisplay {
  if (interval === "monthly") {
    const { amountCents, listAmountCents } = DRIVE_MUSIC_PRICING.monthly;
    return monthlyDisplay(amountCents, listAmountCents);
  }
  return getDriveMusicYearlyDisplay();
}

export function getDriveMusicYearlyDisplay(): PlanPriceDisplay {
  const { amountCents, listAmountCents } = DRIVE_MUSIC_PRICING.yearly;
  return yearlyDisplay(amountCents, listAmountCents);
}

/** One-time Drive+ Lifetime - same early adopter struck-through list price logic. */
export function getDrivePlusLifetimeDisplay(): PlanPriceDisplay {
  const amountCents = DRIVE_PLUS_PRICING.lifetime.amountCents;
  return {
    amount: formatEuroAmount(amountCents),
    listAmount: formatEuroAmount(listPriceBeforeEarlyAdopterDiscount(amountCents)),
    cadence: "once",
  };
}
