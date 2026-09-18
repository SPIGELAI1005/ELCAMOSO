import type Stripe from "stripe";

import {
  getWebhookEventStore,
  resetWebhookEventStoreStateForTests,
} from "@/lib/billing/webhook-event-store-memory";
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  syncStripeSubscriptionRecord,
} from "@/lib/billing/stripe/subscription-sync";
import {
  logStripeWebhookError,
  logStripeWebhookInfo,
  safeWebhookErrorMessage,
} from "@/lib/billing/stripe/webhook-log";
import {
  constructStripeWebhookEvent,
  StripeWebhookVerificationError,
} from "@/lib/billing/stripe/webhook-verify";

export { constructStripeWebhookEvent, StripeWebhookVerificationError };

export interface StripeWebhookDispatchResult {
  eventId: string;
  eventType: string;
  duplicate: boolean;
  handled: boolean;
}

const HANDLED_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.trial_will_end",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

async function handleStripeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      return true;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncStripeSubscriptionRecord(event.data.object as Stripe.Subscription);
      return true;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      return true;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      return true;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      return true;
    case "customer.subscription.trial_will_end":
      await syncStripeSubscriptionRecord(event.data.object as Stripe.Subscription);
      return true;
    default:
      return false;
  }
}

/** Idempotent webhook processor - billing authority; never trusts browser redirects. */
export async function dispatchStripeWebhookEvent(
  event: Stripe.Event,
): Promise<StripeWebhookDispatchResult> {
  const store = getWebhookEventStore();
  const claim = await store.claim(event.id, event.type);

  if (claim === "already_processed") {
    logStripeWebhookInfo("duplicate event skipped", { eventId: event.id, eventType: event.type });
    return {
      eventId: event.id,
      eventType: event.type,
      duplicate: true,
      handled: HANDLED_EVENT_TYPES.has(event.type),
    };
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    await store.markSucceeded(event.id);
    return {
      eventId: event.id,
      eventType: event.type,
      duplicate: false,
      handled: false,
    };
  }

  try {
    const handled = await handleStripeEvent(event);
    await store.markSucceeded(event.id);
    logStripeWebhookInfo("event processed", {
      eventId: event.id,
      eventType: event.type,
      detail: handled ? "handled" : "ignored",
    });
    return {
      eventId: event.id,
      eventType: event.type,
      duplicate: false,
      handled,
    };
  } catch (error) {
    await store.markFailed(event.id, safeWebhookErrorMessage(error));
    logStripeWebhookError("processing failed", { eventId: event.id, eventType: event.type }, error);
    throw error;
  }
}

export { resetWebhookEventStoreStateForTests };
