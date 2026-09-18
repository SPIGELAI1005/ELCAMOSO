import type { Plan } from "@/lib/entitlements/types";
import type { BillingInterval, BillingStatus } from "@/lib/billing/status";

export interface UserSubscriptionRecord {
  userId: string;
  plan: Plan;
  status: BillingStatus;
  interval: BillingInterval | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  /** Set when status first becomes past_due - starts grace clock. */
  pastDueSince?: Date | null;
}

const subscriptions = new Map<string, UserSubscriptionRecord>();

export function resetSubscriptionStoreForTests(): void {
  subscriptions.clear();
}

export function setSubscriptionForUser(record: UserSubscriptionRecord): void {
  subscriptions.set(record.userId, record);
}

export function getSubscriptionForUser(userId: string): UserSubscriptionRecord | null {
  return subscriptions.get(userId) ?? null;
}
