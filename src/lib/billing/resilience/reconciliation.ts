import type { Subscription } from "@/lib/billing/types";
import {
  resolveLocalSubscriptionAccess,
  userHasLocalDrivePlusAccess,
} from "@/lib/billing/resilience/local-access";
import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import { syncStripeSubscriptionById } from "@/lib/billing/stripe/subscription-sync";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import { getWebhookEventStore } from "@/lib/billing/webhook-event-store-memory";
import { isStripeConfigured } from "@/lib/billing/stripe/config";
import { getStripeClient } from "@/lib/billing/stripe/client";
import { wrapStripeBillingError } from "@/lib/billing/resilience/stripe-errors";

export interface BillingHealthSnapshot {
  stripeConfigured: boolean;
  localPlan: "FREE" | "DRIVE_PLUS";
  localAccessReason: string;
  hasStripeCustomer: boolean;
  providerSubscriptionId: string | null;
  failedWebhookCount: number;
  lastPersisted: boolean | null;
}

export interface ReconcileBillingResult {
  ok: boolean;
  message: string;
  subscription: Subscription | null;
  persisted: boolean;
}

export async function getBillingHealthSnapshot(userId: string): Promise<BillingHealthSnapshot> {
  const local = resolveLocalSubscriptionAccess(userId);
  const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(userId);
  const failedWebhookCount = await listFailedWebhookEvents(50);

  let providerSubscriptionId: string | null = null;
  const record = getSubscriptionForUser(userId);
  if (record) {
    const repoSub = await findLatestSubscriptionForUser(userId);
    providerSubscriptionId = repoSub?.providerSubscriptionId ?? null;
  }

  return {
    stripeConfigured: isStripeConfigured(),
    localPlan: local.hasDrivePlusAccess ? "DRIVE_PLUS" : "FREE",
    localAccessReason: local.reason,
    hasStripeCustomer: Boolean(stripeCustomerId),
    providerSubscriptionId,
    failedWebhookCount: failedWebhookCount.length,
    lastPersisted: null,
  };
}

async function findLatestSubscriptionForUser(userId: string): Promise<Subscription | null> {
  const repo = getSubscriptionRepository();
  if ("findLatestByUserId" in repo && typeof repo.findLatestByUserId === "function") {
    return (repo as { findLatestByUserId: (id: string) => Promise<Subscription | null> }).findLatestByUserId(
      userId,
    );
  }
  return null;
}

export async function listFailedWebhookEvents(limit = 20): Promise<
  Array<{ stripeEventId: string; eventType: string; errorMessage?: string }>
> {
  const store = getWebhookEventStore();
  if ("listFailed" in store && typeof store.listFailed === "function") {
    return store.listFailed(limit);
  }
  return [];
}

/** Explicit Stripe pull — never called from entitlement gates. */
export async function reconcileUserBillingFromStripe(
  userId: string,
): Promise<ReconcileBillingResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      message: "Stripe is not configured",
      subscription: null,
      persisted: false,
    };
  }

  const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(userId);
  if (!stripeCustomerId) {
    return {
      ok: false,
      message: "No Stripe customer linked",
      subscription: null,
      persisted: false,
    };
  }

  try {
    const stripe = getStripeClient();
    const page = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 1,
    });
    const latest = page.data[0];
    if (!latest) {
      return {
        ok: true,
        message: "No subscription found on Stripe",
        subscription: null,
        persisted: true,
      };
    }

    const saved = await syncStripeSubscriptionById(latest.id);
    return {
      ok: true,
      message: "Subscription reconciled from Stripe",
      subscription: saved,
      persisted: true,
    };
  } catch (error) {
    throw wrapStripeBillingError(error);
  }
}

export { userHasLocalDrivePlusAccess };
