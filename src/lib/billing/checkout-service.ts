import type Stripe from "stripe";

import type { CheckoutPlanRequest } from "@/lib/billing/checkout-request";
import { describeCheckoutPlan } from "@/lib/billing/checkout-request";
import { assertAllowedCheckoutOrigin } from "@/lib/billing/checkout-origin";
import { isBillingAvailable } from "@/lib/billing/billing-available";
import { ensureStripeCustomer } from "@/lib/billing/stripe/customer";
import { getStripeClient } from "@/lib/billing/stripe/client";
import {
  isStripeConfigured,
  readStripeConfig,
  resolveStripePriceId,
} from "@/lib/billing/stripe/config";
import { buildCheckoutSessionTaxParams } from "@/lib/billing/stripe/tax-config";
import { createStripePortalSession } from "@/lib/billing/stripe/portal";
import { userHasActiveDrivePlusSubscription } from "@/lib/billing/stripe/subscription-guard";
import { wrapStripeBillingError } from "@/lib/billing/resilience/stripe-errors";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import { hasActiveLifetimeGrant } from "@/lib/billing/lifetime-store";

export interface BeginCheckoutInput {
  userId: string;
  email: string;
  origin: string;
  request: CheckoutPlanRequest;
  /** Request Host header - used to validate origin when allowlist is unset. */
  trustedHost?: string | null;
  /** Optional Sound Spin discount reservation (Prompt 13). Never trust client coupon ids. */
  rewardReservationId?: string | null;
}

export type BeginCheckoutResult =
  | {
      action: "checkout";
      url: string;
      sessionId: string;
      /** Shown when buying Lifetime while a subscription is still active. */
      note?: string;
    }
  | {
      action: "manage";
      url: string;
      message: string;
    };

function sanitizeOrigin(origin: string, trustedHost?: string | null): string {
  return assertAllowedCheckoutOrigin(origin, trustedHost);
}

function sanitizeReturnPath(returnPath: string): string {
  const path = returnPath.trim();
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Invalid return path");
  }
  return path;
}

/** Starts Checkout or returns Manage Subscription when Drive+ is already active. */
export async function beginDrivePlusCheckout(
  input: BeginCheckoutInput,
): Promise<BeginCheckoutResult> {
  if (!isBillingAvailable()) {
    throw new Error("Billing is not available");
  }

  const described = describeCheckoutPlan(input.request.plan, input.request.interval);
  const repository = getUserBillingRepository();
  const existingCustomerId = await repository.getStripeCustomerId(input.userId);

  const isLifetime = described.mode === "payment";
  const ownsLifetime = hasActiveLifetimeGrant(input.userId);
  const hasActiveSubscription =
    !ownsLifetime &&
    (await userHasActiveDrivePlusSubscription(input.userId, existingCustomerId));

  if (ownsLifetime || (!isLifetime && hasActiveSubscription)) {
    const stripeCustomerId =
      existingCustomerId ??
      (await ensureStripeCustomer({ userId: input.userId, email: input.email }));
    const portal = await createStripePortalSession({
      stripeCustomerId,
      origin: sanitizeOrigin(input.origin, input.trustedHost),
      returnPath: sanitizeReturnPath(input.request.returnPath ?? "/settings"),
    });
    return {
      action: "manage",
      url: portal.url,
      message: ownsLifetime
        ? "You already own Drive+ Lifetime."
        : "You already have an active Drive+ subscription.",
    };
  }

  const stripeCustomerId = await ensureStripeCustomer({
    userId: input.userId,
    email: input.email,
  });

  const config = readStripeConfig();
  const priceId = resolveStripePriceId(described.commercialPlanId, config);
  const stripe = getStripeClient();
  const origin = sanitizeOrigin(input.origin, input.trustedHost);
  const returnPath = sanitizeReturnPath(input.request.returnPath ?? "/settings");
  const source = input.request.source?.slice(0, 64);

  const metadata: Record<string, string> = {
    userId: input.userId,
    plan: input.request.plan,
    interval: input.request.interval,
    commercialPlanId: described.commercialPlanId,
    elcamosoPlan: described.entitlementPlan,
    billingInterval: described.billingInterval ?? "lifetime",
  };
  if (source) metadata["source"] = source;
  if (isLifetime && hasActiveSubscription) metadata["hadActiveSubscription"] = "true";
  if (input.request.upgradeToken) metadata["upgradeToken"] = input.request.upgradeToken;

  if (isLifetime) {
    const params = buildLifetimeCheckoutParams({
      priceId,
      stripeCustomerId,
      origin,
      returnPath,
      userId: input.userId,
      metadata,
    });
    const session = await stripe.checkout.sessions.create(params).catch((error) => {
      throw wrapStripeBillingError(error);
    });
    if (!session.url) {
      throw new Error("Checkout session missing redirect URL");
    }
    return {
      action: "checkout",
      url: session.url,
      sessionId: session.id,
      ...(hasActiveSubscription
        ? {
            note: "You still have an active Drive+ subscription. After buying Lifetime, cancel it in Manage plan so you are not charged again.",
          }
        : {}),
    };
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}${returnPath}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnPath}?billing=cancel`,
    client_reference_id: input.userId,
    metadata,
    subscription_data: {
      metadata,
    },
    ...buildCheckoutSessionTaxParams(),
  };

  if (input.rewardReservationId && input.request.interval !== "lifetime") {
    const { isRewardDiscountsEnabled } = await import("@/lib/rewards/discount/flag");
    const { prepareCheckoutRewardDiscount, bindCheckoutSessionToReservation } = await import(
      "@/lib/rewards/discount/service"
    );
    if (!isRewardDiscountsEnabled()) {
      throw new Error("Reward discounts are not enabled");
    }
    const prepared = prepareCheckoutRewardDiscount({
      accountId: input.userId,
      reservationId: input.rewardReservationId,
      interval: input.request.interval,
    });
    if (!prepared.ok) {
      throw new Error(prepared.message);
    }
    params.discounts = [{ coupon: prepared.couponId }];
    Object.assign(metadata, prepared.metadata);
    params.metadata = metadata;
    params.subscription_data = { metadata };
    // Session id bound after create — see below.
    const session = await stripe.checkout.sessions
      .create(params, {
        idempotencyKey: `reward-checkout:${input.rewardReservationId}:${priceId}`,
      })
      .catch((error) => {
        throw wrapStripeBillingError(error);
      });
    if (!session.url) {
      throw new Error("Checkout session missing redirect URL");
    }
    bindCheckoutSessionToReservation({
      reservationId: input.rewardReservationId,
      accountId: input.userId,
      checkoutSessionId: session.id,
      stripeCustomerId,
    });
    return {
      action: "checkout",
      url: session.url,
      sessionId: session.id,
    };
  }

  const session = await stripe.checkout.sessions.create(params).catch((error) => {
    throw wrapStripeBillingError(error);
  });
  if (!session.url) {
    throw new Error("Checkout session missing redirect URL");
  }

  return {
    action: "checkout",
    url: session.url,
    sessionId: session.id,
  };
}

/** One-time Drive+ Lifetime Checkout payload (mode "payment", never a subscription). */
export function buildLifetimeCheckoutParams(input: {
  priceId: string;
  stripeCustomerId: string;
  origin: string;
  returnPath: string;
  userId: string;
  metadata: Record<string, string>;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    customer: input.stripeCustomerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${input.origin}${input.returnPath}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}${input.returnPath}?billing=cancel`,
    client_reference_id: input.userId,
    metadata: input.metadata,
    payment_intent_data: { metadata: input.metadata },
    invoice_creation: { enabled: true, invoice_data: { metadata: input.metadata } },
    ...buildCheckoutSessionTaxParams(),
  };
}

export function resolveCheckoutOrigin(request: Request): string {
  const origin = request.headers.get("origin")?.trim();
  if (origin) return origin;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
