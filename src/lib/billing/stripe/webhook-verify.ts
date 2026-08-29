import Stripe from "stripe";

import { getStripeClient } from "@/lib/billing/stripe/client";
import { readStripeConfig } from "@/lib/billing/stripe/config";

export class StripeWebhookVerificationError extends Error {
  constructor(message = "Invalid Stripe webhook signature") {
    super(message);
    this.name = "StripeWebhookVerificationError";
  }
}

/** Verify Stripe-Signature against the raw UTF-8 request body — server-only. */
export function constructStripeWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
): Stripe.Event {
  if (!signatureHeader) {
    throw new StripeWebhookVerificationError("Missing Stripe-Signature header");
  }

  const { webhookSecret } = readStripeConfig();
  if (!webhookSecret) {
    throw new Error("Stripe webhook secret is not configured");
  }

  try {
    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      throw new StripeWebhookVerificationError();
    }
    throw error;
  }
}
