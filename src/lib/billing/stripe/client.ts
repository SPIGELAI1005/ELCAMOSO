import Stripe from "stripe";

import { readStripeConfig } from "@/lib/billing/stripe/config";

let stripeClient: Stripe | null = null;

/** Server-only Stripe SDK singleton. Never import from client code. */
export function getStripeClient(): Stripe {
  const config = readStripeConfig();
  if (!config.secretKey) {
    throw new Error("Stripe is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.secretKey, {
      typescript: true,
    });
  }
  return stripeClient;
}

/** Reset cached client — tests only. */
export function resetStripeClientForTests(): void {
  stripeClient = null;
}
