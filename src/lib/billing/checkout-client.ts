import type { CheckoutIntervalSlug } from "@/lib/billing/checkout-request";
import { createCheckoutSessionFn } from "@/lib/billing/server-fns";

export async function openDrivePlusCheckout(
  interval: CheckoutIntervalSlug,
  returnPath = "/pricing",
  source = "pricing",
): Promise<void> {
  const result = await createCheckoutSessionFn({
    data: {
      sessionToken: null,
      plan: "drive_plus",
      interval,
      origin: window.location.origin,
      returnPath,
      source,
    },
  });
  window.location.assign(result.url);
}
