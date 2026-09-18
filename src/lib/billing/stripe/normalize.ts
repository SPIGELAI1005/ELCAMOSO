import type Stripe from "stripe";

import type { BillingInterval, BillingStatus } from "@/lib/billing/status";
import { parseBillingInterval } from "@/lib/billing/status";
import type { UpsertSubscriptionInput } from "@/lib/billing/subscription-repository";
import { readStripeConfig } from "@/lib/billing/stripe/config";
import type { Plan } from "@/lib/entitlements/types";

export function normalizeStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "free";
    default:
      return "free";
  }
}

export function resolveIntervalFromStripePrice(priceId: string): BillingInterval | null {
  const config = readStripeConfig();
  if (priceId === config.prices.drive_plus_monthly) return "month";
  if (priceId === config.prices.drive_plus_yearly) return "year";
  return null;
}

export function resolvePlanFromMetadata(metadata: Stripe.Metadata | null | undefined): Plan | null {
  const raw = metadata?.["elcamosoPlan"]?.toUpperCase();
  if (raw === "DRIVE_PLUS") return "DRIVE_PLUS";
  return null;
}

/** Drive+ is granted only when the Stripe Price matches configured env ids. */
export function resolvePlanFromStripePrice(priceId: string): Plan | null {
  if (!priceId.trim()) return null;
  return resolveIntervalFromStripePrice(priceId) ? "DRIVE_PLUS" : null;
}

export function isKnownDrivePlusStripePrice(priceId: string): boolean {
  return resolvePlanFromStripePrice(priceId) !== null;
}

export function resolveIntervalFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): BillingInterval | null {
  const raw = metadata?.["billingInterval"];
  if (typeof raw !== "string") return null;
  if (raw === "monthly") return "month";
  if (raw === "yearly") return "year";
  return parseBillingInterval(raw);
}

export function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
}

export function stripeSubscriptionId(
  subscription: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

export function normalizeStripeSubscription(
  subscription: Stripe.Subscription,
  userId: string,
): UpsertSubscriptionInput {
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const primaryItem = subscription.items.data[0];
  const interval =
    resolveIntervalFromStripePrice(priceId) ??
    resolveIntervalFromMetadata(subscription.metadata) ??
    null;
  const customerId = stripeCustomerId(subscription.customer);
  const plan =
    resolvePlanFromStripePrice(priceId) ?? resolvePlanFromMetadata(subscription.metadata);

  if (!plan) {
    throw new Error("Subscription is not a recognized Drive+ Stripe price");
  }

  return {
    userId,
    provider: "stripe",
    providerCustomerId: customerId ?? "",
    providerSubscriptionId: subscription.id,
    plan,
    interval,
    status: normalizeStripeSubscriptionStatus(subscription.status),
    currentPeriodStart: primaryItem?.current_period_start
      ? new Date(primaryItem.current_period_start * 1000)
      : null,
    currentPeriodEnd: primaryItem?.current_period_end
      ? new Date(primaryItem.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

export function normalizeDeletedStripeSubscription(
  subscription: Stripe.Subscription,
  userId: string,
): UpsertSubscriptionInput {
  const base = normalizeStripeSubscription(subscription, userId);
  return {
    ...base,
    status: "canceled",
  };
}
