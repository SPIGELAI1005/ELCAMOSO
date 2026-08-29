import type { User } from "@/lib/account/types";
import type { Subscription } from "@/lib/billing/types";
import type { SubscriptionRow, UserRow } from "@/lib/db/schema";

export function userRowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    stripeCustomerId: row.stripeCustomerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function subscriptionRowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerCustomerId: row.providerCustomerId,
    providerSubscriptionId: row.providerSubscriptionId,
    plan: row.plan,
    interval: row.interval,
    status: row.status,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
