import type { BillingDisplayInterval } from "@/lib/billing/plan-display";

/** Search params used when a Founders Pack CTA opens Pricing. */
export const FOUNDERS_PRICING_SEARCH = {
  billing: "yearly",
  from: "founders",
} as const;

/** Hash of the Founders Pack block on /pricing (plans sit just below). */
export const FOUNDERS_PRICING_HASH = "founders";

export type PricingBillingParam = BillingDisplayInterval;
export type PricingFromParam = "founders";

/** Parse /pricing?billing=yearly|monthly. Anything else is ignored. */
export function parsePricingBillingParam(value: unknown): PricingBillingParam | undefined {
  return value === "yearly" || value === "monthly" ? value : undefined;
}

export function parsePricingFromParam(value: unknown): PricingFromParam | undefined {
  return value === "founders" ? "founders" : undefined;
}

/**
 * Toggle shown when Pricing loads. A present, valid `billing` query wins;
 * otherwise monthly. No storage — a later visit without the param stays monthly.
 */
export function pricingDisplayIntervalFromSearch(billing: unknown): BillingDisplayInterval {
  return parsePricingBillingParam(billing) ?? "monthly";
}
