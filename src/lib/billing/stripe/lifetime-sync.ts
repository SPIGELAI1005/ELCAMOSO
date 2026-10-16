import type Stripe from "stripe";

import {
  findUserIdForLifetimePaymentIntent,
  lifetimeProviderId,
  recordLifetimeGrant,
  revokeLifetimeGrant,
} from "@/lib/billing/lifetime-store";
import { persistAndProvisionSubscription } from "@/lib/billing/resilience/persist-subscription";
import { readStripeConfig } from "@/lib/billing/stripe/config";
import { stripeCustomerId } from "@/lib/billing/stripe/normalize";
import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import { notifyTeslaUpgradeEntitlementGranted } from "@/lib/tesla-upgrade/notify";
import { recordServerMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

export const LIFETIME_COMMERCIAL_PLAN_ID = "drive_plus_lifetime";

export class StripeLifetimeProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeLifetimeProcessingError";
  }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** True when a payment-mode Checkout Session is a Drive+ Lifetime purchase. */
export function isLifetimeCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.mode === "payment" && session.metadata?.["commercialPlanId"] === LIFETIME_COMMERCIAL_PLAN_ID;
}

function sessionPriceMatchesLifetime(session: Stripe.Checkout.Session): boolean {
  const configured = readStripeConfig().prices.drive_plus_lifetime;
  if (!configured) return false;
  const items = session.line_items?.data;
  if (!items || items.length === 0) return true; // line items not expanded on webhook payloads
  return items.some((item) => item.price?.id === configured);
}

/** Grants Drive+ forever for a paid lifetime Checkout Session. Idempotent per payment intent. */
export async function handleLifetimeCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!isLifetimeCheckoutSession(session)) {
    return { skipped: true as const, reason: "not_lifetime" };
  }
  if (session.payment_status !== "paid") {
    // Async methods (e.g. SEPA) complete later via checkout.session.async_payment_succeeded.
    return { skipped: true as const, reason: "payment_pending" };
  }
  if (!sessionPriceMatchesLifetime(session)) {
    throw new StripeLifetimeProcessingError("Lifetime checkout price does not match configuration");
  }

  const paymentIntentId = idOf(session.payment_intent);
  if (!paymentIntentId) {
    throw new StripeLifetimeProcessingError("Lifetime checkout missing payment intent");
  }

  const customerId = stripeCustomerId(session.customer);
  const metaUser = session.metadata?.["userId"]?.trim() || null;
  const fromCustomer = customerId
    ? await getUserBillingRepository().getUserIdByStripeCustomerId(customerId)
    : null;
  if (fromCustomer && metaUser && fromCustomer !== metaUser) {
    throw new StripeLifetimeProcessingError("Stripe customer owner does not match metadata userId");
  }
  const userId = fromCustomer ?? metaUser ?? session.client_reference_id?.trim() ?? null;
  if (!userId) {
    throw new StripeLifetimeProcessingError("Unable to resolve user for lifetime checkout");
  }
  if (customerId) {
    await getUserBillingRepository().setStripeCustomerId(userId, customerId);
  }

  const { created } = recordLifetimeGrant({
    userId,
    paymentIntentId,
    checkoutSessionId: session.id,
    stripeCustomerId: customerId,
  });

  const providerSubscriptionId = lifetimeProviderId(paymentIntentId);
  const existing = await getSubscriptionRepository().findByProviderSubscriptionId(
    "stripe",
    providerSubscriptionId,
  );
  await persistAndProvisionSubscription(
    {
      userId,
      provider: "stripe",
      providerCustomerId: customerId ?? "",
      providerSubscriptionId,
      plan: "DRIVE_PLUS",
      interval: null,
      status: "active",
      currentPeriodStart: new Date((session.created ?? Date.now() / 1000) * 1000),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    existing,
  );

  if (created) {
    const upgradeToken = session.metadata?.["upgradeToken"];
    notifyTeslaUpgradeEntitlementGranted(userId, { ...(upgradeToken ? { upgradeToken } : {}) });
    recordServerMonetizationEvent("checkout_completed", {
      source: session.metadata?.["source"] ?? "billing",
      plan: "drive_plus",
      interval: "lifetime",
    });
  }
  return { skipped: false as const, userId, paymentIntentId, created };
}

/** Revokes lifetime access when its payment is refunded (full or partial) or charged back. */
export async function handleLifetimeChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return { skipped: true as const, reason: "no_payment_intent" };

  const userId =
    findUserIdForLifetimePaymentIntent(paymentIntentId) ??
    (charge.metadata?.["commercialPlanId"] === LIFETIME_COMMERCIAL_PLAN_ID
      ? charge.metadata?.["userId"]?.trim() || null
      : null);
  const providerSubscriptionId = lifetimeProviderId(paymentIntentId);
  const existing = await getSubscriptionRepository().findByProviderSubscriptionId(
    "stripe",
    providerSubscriptionId,
  );
  const resolvedUserId = userId ?? existing?.userId ?? null;
  if (!resolvedUserId) return { skipped: true as const, reason: "not_lifetime" };

  revokeLifetimeGrant(paymentIntentId);
  await persistAndProvisionSubscription(
    {
      userId: resolvedUserId,
      provider: "stripe",
      providerCustomerId: stripeCustomerId(charge.customer) ?? existing?.providerCustomerId ?? "",
      providerSubscriptionId,
      plan: "DRIVE_PLUS",
      interval: null,
      status: "canceled",
      currentPeriodStart: existing?.currentPeriodStart ?? null,
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
    },
    existing,
  );
  return { skipped: false as const, userId: resolvedUserId, paymentIntentId };
}
