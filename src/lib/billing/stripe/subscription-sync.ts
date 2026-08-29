import type Stripe from "stripe";

import { persistAndProvisionSubscription } from "@/lib/billing/resilience/persist-subscription";
import { logStripeWebhookInfo } from "@/lib/billing/stripe/webhook-log";
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import { getStripeClient } from "@/lib/billing/stripe/client";
import {
  normalizeDeletedStripeSubscription,
  normalizeStripeSubscription,
  stripeCustomerId,
  stripeSubscriptionId,
  isKnownDrivePlusStripePrice,
} from "@/lib/billing/stripe/normalize";
import { notifyTeslaUpgradeEntitlementGranted } from "@/lib/tesla-upgrade/notify";
import { isTrialUserId } from "@/lib/dynamic-drive-trial/service";
import { getDynamicDriveTrialService } from "@/lib/dynamic-drive-trial/service";
import {
  monetizationMetaFromStripeMetadata,
  recordServerMonetizationEvent,
} from "@/lib/telemetry/monetization-analytics";

export class StripeWebhookProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookProcessingError";
  }
}

export async function resolveUserIdForStripeCustomer(
  customerId: string,
  metadata?: Stripe.Metadata | null,
): Promise<string | null> {
  const fromCustomer = await getUserBillingRepository().getUserIdByStripeCustomerId(customerId);
  const fromMetadata = metadata?.userId;
  const metadataUserId =
    typeof fromMetadata === "string" && fromMetadata.trim() ? fromMetadata.trim() : null;

  if (fromCustomer && metadataUserId && fromCustomer !== metadataUserId) {
    throw new StripeWebhookProcessingError(
      "Stripe customer owner does not match subscription metadata userId",
    );
  }

  return fromCustomer ?? metadataUserId;
}

export async function resolveUserIdForStripeSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const customerId = stripeCustomerId(subscription.customer);
  if (customerId) {
    return resolveUserIdForStripeCustomer(customerId, subscription.metadata);
  }

  const fromMeta = subscription.metadata?.userId;
  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return fromMeta.trim();
  }

  return null;
}

async function maybeCompleteDynamicDriveTrial(userId: string, status: string): Promise<void> {
  if (!isTrialUserId(userId)) return;
  if (status !== "trialing" && status !== "active" && status !== "past_due") return;
  try {
    await getDynamicDriveTrialService().completeTrial(userId);
  } catch {
    /* trial may not exist */
  }
}

/** Persists normalized subscription state and provisions entitlements — webhook authority. */
export async function syncStripeSubscriptionRecord(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  if (!isKnownDrivePlusStripePrice(priceId)) {
    throw new StripeWebhookProcessingError("Unrecognized Stripe price for Drive+");
  }

  const userId = await resolveUserIdForStripeSubscription(subscription);
  if (!userId) {
    throw new StripeWebhookProcessingError("Unable to resolve user for Stripe subscription");
  }

  const customerId = stripeCustomerId(subscription.customer);
  if (customerId) {
    await getUserBillingRepository().setStripeCustomerId(userId, customerId);
  }

  const normalized = normalizeStripeSubscription(subscription, userId);
  const existing = await getSubscriptionRepository().findByProviderSubscriptionId(
    normalized.provider,
    normalized.providerSubscriptionId,
  );
  const { subscription: saved, persisted } = await persistAndProvisionSubscription(
    normalized,
    existing,
  );
  if (!persisted) {
    logStripeWebhookInfo("entitlements provisioned without durable persistence", {
      userId,
      providerSubscriptionId: normalized.providerSubscriptionId,
    });
  }
  if (hasDrivePlusSubscriptionAccess(saved)) {
    notifyTeslaUpgradeEntitlementGranted(userId, {
      upgradeToken: subscription.metadata?.upgradeToken,
    });
  }
  await maybeCompleteDynamicDriveTrial(userId, saved.status);
  return saved;
}

export async function syncStripeSubscriptionById(subscriptionId: string) {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncStripeSubscriptionRecord(subscription);
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") {
    return { skipped: true as const, reason: "non_subscription_checkout" };
  }

  const customerId = stripeCustomerId(session.customer);
  const userId =
    (customerId
      ? await resolveUserIdForStripeCustomer(customerId, session.metadata)
      : null) ??
    (typeof session.metadata?.userId === "string" ? session.metadata.userId.trim() : null) ??
    (typeof session.client_reference_id === "string"
      ? session.client_reference_id.trim()
      : null);

  if (!userId) {
    throw new StripeWebhookProcessingError("Unable to resolve user for checkout session");
  }

  if (customerId) {
    await getUserBillingRepository().setStripeCustomerId(userId, customerId);
  }

  const subscriptionId = stripeSubscriptionId(session.subscription);
  if (!subscriptionId) {
    throw new StripeWebhookProcessingError("Checkout session missing subscription id");
  }

  const saved = await syncStripeSubscriptionById(subscriptionId);
  notifyTeslaUpgradeEntitlementGranted(userId, {
    upgradeToken: session.metadata?.upgradeToken,
  });
  const monetizationMeta = monetizationMetaFromStripeMetadata(session.metadata ?? undefined);
  recordServerMonetizationEvent("checkout_completed", monetizationMeta);
  recordServerMonetizationEvent("subscription_started", monetizationMeta);
  return { skipped: false as const, subscriptionId: saved.providerSubscriptionId, userId };
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdForStripeSubscription(subscription);
  if (!userId) {
    throw new StripeWebhookProcessingError("Unable to resolve user for deleted subscription");
  }

  const normalized = normalizeDeletedStripeSubscription(subscription, userId);
  const existing = await getSubscriptionRepository().findByProviderSubscriptionId(
    normalized.provider,
    normalized.providerSubscriptionId,
  );
  const { subscription: saved } = await persistAndProvisionSubscription(normalized, existing);
  recordServerMonetizationEvent("subscription_canceled", {
    source: subscription.metadata?.source ?? "billing",
    plan: "drive_plus",
    interval:
      subscription.metadata?.interval === "monthly" ||
      subscription.metadata?.interval === "yearly"
        ? subscription.metadata.interval
        : undefined,
  });
  return saved;
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = stripeSubscriptionId(invoice.subscription);
  if (!subscriptionId) return { skipped: true as const, reason: "no_subscription" };
  return syncStripeSubscriptionById(subscriptionId);
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = stripeSubscriptionId(invoice.subscription);
  if (!subscriptionId) return { skipped: true as const, reason: "no_subscription" };
  return syncStripeSubscriptionById(subscriptionId);
}
