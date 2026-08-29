import { isMonetizationEnabled } from "@/lib/billing/monetization-flag";
import { isStripeConfigured } from "@/lib/billing/stripe/config";

/** New purchases and upgrade flows — requires flag and Stripe config. */
export function isBillingAvailable(): boolean {
  return isMonetizationEnabled() && isStripeConfigured();
}

/** Existing subscribers can manage plans when Stripe is configured. */
export function isBillingManagementAvailable(): boolean {
  return isStripeConfigured();
}
