import type { Plan } from "@/lib/entitlements/types";
import type { BillingInterval, BillingStatus, SubscriptionProvider } from "@/lib/billing/status";

/** Billing subscription record — no payment method or card fields. */
export interface Subscription {
  id: string;
  userId: string;
  provider: SubscriptionProvider;
  providerCustomerId: string;
  providerSubscriptionId: string;
  plan: Plan;
  interval: BillingInterval | null;
  status: BillingStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type { BillingInterval, BillingStatus, SubscriptionProvider };
