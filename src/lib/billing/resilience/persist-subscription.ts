import { randomUUID } from "node:crypto";

import type { UpsertSubscriptionInput } from "@/lib/billing/subscription-repository";
import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import { provisionEntitlementsFromSubscription } from "@/lib/billing/provision-entitlements";
import type { Subscription } from "@/lib/billing/types";

export function subscriptionFromUpsertInput(
  input: UpsertSubscriptionInput,
  existing?: Subscription | null,
): Subscription {
  const now = new Date();
  return {
    id: existing?.id ?? randomUUID(),
    userId: input.userId,
    provider: input.provider,
    providerCustomerId: input.providerCustomerId,
    providerSubscriptionId: input.providerSubscriptionId,
    plan: input.plan,
    interval: input.interval,
    status: input.status,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export interface PersistSubscriptionResult {
  subscription: Subscription;
  persisted: boolean;
}

/**
 * Writes subscription to the runtime entitlement store always.
 * Persists to the repository when available (Postgres may be down).
 */
export async function persistAndProvisionSubscription(
  input: UpsertSubscriptionInput,
  existing?: Subscription | null,
): Promise<PersistSubscriptionResult> {
  try {
    const saved = await getSubscriptionRepository().upsert(input);
    provisionEntitlementsFromSubscription(saved);
    return { subscription: saved, persisted: true };
  } catch {
    const fallback = subscriptionFromUpsertInput(input, existing);
    provisionEntitlementsFromSubscription(fallback);
    return { subscription: fallback, persisted: false };
  }
}
