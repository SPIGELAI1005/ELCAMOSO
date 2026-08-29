import type { BillingInterval, BillingStatus } from "@/lib/billing/status";
import type { Subscription } from "@/lib/billing/types";
import type { Plan } from "@/lib/entitlements/types";

export interface UpsertSubscriptionInput {
  userId: string;
  provider: Subscription["provider"];
  providerCustomerId: string;
  providerSubscriptionId: string;
  plan: Plan;
  interval: BillingInterval | null;
  status: BillingStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionRepository {
  upsert(input: UpsertSubscriptionInput): Promise<Subscription>;
  findByProviderSubscriptionId(
    provider: Subscription["provider"],
    providerSubscriptionId: string,
  ): Promise<Subscription | null>;
}
