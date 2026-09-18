/** Normalized billing lifecycle - provider-agnostic, no card data. */
export type BillingStatus = "free" | "trialing" | "active" | "past_due" | "paused" | "canceled";

export const BILLING_STATUSES: readonly BillingStatus[] = [
  "free",
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
] as const;

export type SubscriptionProvider = "stripe";

export const SUBSCRIPTION_PROVIDERS: readonly SubscriptionProvider[] = ["stripe"] as const;

export type BillingInterval = "month" | "year";

export const BILLING_INTERVALS: readonly BillingInterval[] = ["month", "year"] as const;

/** Whether billing still shows an active Stripe subscription (checkout guard - not access policy). */
export function isPaidBillingStatus(status: BillingStatus): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

export function parseBillingStatus(value: string): BillingStatus | null {
  return BILLING_STATUSES.includes(value as BillingStatus) ? (value as BillingStatus) : null;
}

export function parseSubscriptionProvider(value: string): SubscriptionProvider | null {
  return SUBSCRIPTION_PROVIDERS.includes(value as SubscriptionProvider)
    ? (value as SubscriptionProvider)
    : null;
}

export function parseBillingInterval(value: string): BillingInterval | null {
  return BILLING_INTERVALS.includes(value as BillingInterval) ? (value as BillingInterval) : null;
}
