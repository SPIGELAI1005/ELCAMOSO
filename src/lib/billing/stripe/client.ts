import Stripe from "stripe";

import { readStripeConfig } from "@/lib/billing/stripe/config";

/**
 * Pinned to the Stripe Node SDK's bundled OpenAPI version (stripe@22 → 2026-08-26.dahlia).
 * Do not float per-request; reward discount + webhook code assumes this API shape.
 */
export const ELCAMOSO_STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

let stripeClient: Stripe | null = null;

/** Server-only Stripe SDK singleton. Never import from client code. */
export function getStripeClient(): Stripe {
  const config = readStripeConfig();
  if (!config.secretKey) {
    throw new Error("Stripe is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.secretKey, {
      apiVersion: ELCAMOSO_STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeClient;
}

/** Reset cached client - tests only. */
export function resetStripeClientForTests(): void {
  stripeClient = null;
}
