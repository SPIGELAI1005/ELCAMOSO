import { randomUUID } from "node:crypto";

import type { UpsertSubscriptionInput } from "@/lib/billing/subscription-repository";
import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import { provisionEntitlementsFromSubscription } from "@/lib/billing/provision-entitlements";
import type { Subscription } from "@/lib/billing/types";
import {
  ensureUserRow,
  hydrateUserBillingState,
  invalidateDurableBillingCache,
  isDurableBillingEnabled,
} from "@/lib/billing/durable-state.server";

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
  const durable = isDurableBillingEnabled();
  try {
    if (durable) {
      // Load this user's durable state first so lifetime / other rows are taken into account.
      await hydrateUserBillingState(input.userId, { force: true });
      await ensureUserRow(input.userId);
    }
    const saved = await getSubscriptionRepository().upsert(input);
    provisionEntitlementsFromSubscription(saved);
    if (durable) invalidateDurableBillingCache(input.userId);
    return { subscription: saved, persisted: true };
  } catch (error) {
    const fallback = subscriptionFromUpsertInput(input, existing);
    provisionEntitlementsFromSubscription(fallback);
    // With Postgres configured, a failed write must fail the webhook so Stripe retries it -
    // otherwise other instances / cold starts would never see this change.
    if (durable) throw error;
    return { subscription: fallback, persisted: false };
  }
}
