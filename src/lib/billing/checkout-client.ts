import type { CheckoutIntervalSlug, CheckoutPlanSlug } from "@/lib/billing/checkout-request";
import { createCheckoutSessionFn } from "@/lib/billing/server-fns";

export async function openDrivePlusCheckout(
  interval: CheckoutIntervalSlug,
  returnPath = "/pricing",
  source = "pricing",
  plan: CheckoutPlanSlug = "drive_plus",
): Promise<void> {
  const result = await createCheckoutSessionFn({
    data: {
      sessionToken: null,
      plan,
      interval,
      origin: window.location.origin,
      returnPath,
      source,
    },
  });
  window.location.assign(result.url);
}
