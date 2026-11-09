/**
 * Founders Pack one-time purchase (Drive Unlimited for 4 months from payment).
 *
 * Stripe Price id is STRIPE_PRICE_FOUNDERS_PACK — a placeholder until the owner
 * creates the product. This module does not invent a euro amount.
 */
import type Stripe from "stripe";

import { persistEntitlementGrantsForAccount } from "@/lib/billing/durable-state.server";
import { readStripeConfig } from "@/lib/billing/stripe/config";
import { stripeCustomerId } from "@/lib/billing/stripe/normalize";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import { FOUNDERS_PACK_GRANT_SOURCE } from "@/lib/founders/founders";
import { recordServerMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

export const FOUNDERS_PACK_COMMERCIAL_PLAN_ID = "founders_pack";

export class StripeFoundersPackProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeFoundersPackProcessingError";
  }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function isFoundersPackCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.mode === "payment" && session.metadata?.["commercialPlanId"] === FOUNDERS_PACK_COMMERCIAL_PLAN_ID;
}

function sessionPriceMatchesFoundersPack(session: Stripe.Checkout.Session): boolean {
  const configured = readStripeConfig().prices.founders_pack;
  if (!configured) return false;
  const items = session.line_items?.data;
  if (!items || items.length === 0) return true;
  return items.some((item) => item.price?.id === configured);
}

/** Grants Drive Unlimited for 4 months from the paid Founders Pack checkout. Idempotent. */
export async function handleFoundersPackCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!isFoundersPackCheckoutSession(session)) {
    return { skipped: true as const, reason: "not_founders_pack" };
  }
  if (session.payment_status !== "paid") {
    return { skipped: true as const, reason: "payment_pending" };
  }
  if (!sessionPriceMatchesFoundersPack(session)) {
    throw new StripeFoundersPackProcessingError(
      "Founders Pack checkout price does not match STRIPE_PRICE_FOUNDERS_PACK",
    );
  }

  const paymentIntentId = idOf(session.payment_intent);
  if (!paymentIntentId) {
    throw new StripeFoundersPackProcessingError("Founders Pack checkout missing payment intent");
  }

  const customerId = stripeCustomerId(session.customer);
  const metaUser = session.metadata?.["userId"]?.trim() || null;
  const fromCustomer = customerId
    ? await getUserBillingRepository().getUserIdByStripeCustomerId(customerId)
    : null;
  if (fromCustomer && metaUser && fromCustomer !== metaUser) {
    throw new StripeFoundersPackProcessingError("Stripe customer owner does not match metadata userId");
  }
  const userId = fromCustomer ?? metaUser ?? session.client_reference_id?.trim() ?? null;
  if (!userId) {
    throw new StripeFoundersPackProcessingError("Unable to resolve user for Founders Pack checkout");
  }
  if (customerId) {
    await getUserBillingRepository().setStripeCustomerId(userId, customerId);
  }

  const purchasedAt = (session.created ? session.created * 1000 : Date.now());
  const { claimFounderSeat, grantFoundersPackUnlimited, foundersPackPurchasedAt } = await import(
    "@/lib/founders/founders.server"
  );
  const already = foundersPackPurchasedAt(userId);
  await claimFounderSeat(userId, null, purchasedAt);
  const until = grantFoundersPackUnlimited(userId, already ?? purchasedAt);
  await persistEntitlementGrantsForAccount(userId).catch((error: unknown) => {
    console.error(
      "[founders-pack] persist grants failed",
      error instanceof Error ? error.message : error,
    );
  });

  if (already == null) {
    recordServerMonetizationEvent("checkout_completed", {
      source: session.metadata?.["source"] ?? "billing",
      plan: "founders",
      interval: "lifetime",
    });
  }
  return {
    skipped: false as const,
    userId,
    paymentIntentId,
    until,
    source: FOUNDERS_PACK_GRANT_SOURCE,
    created: already == null,
  };
}
