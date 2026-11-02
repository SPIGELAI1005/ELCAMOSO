import { createServerFn } from "@tanstack/react-start";

import { getBillingPublicConfig } from "@/lib/billing/public-config";

/** Client-safe entry - no auth/Stripe handler imports. */
export const getBillingPublicConfigFn = createServerFn({ method: "POST" }).handler(async () => {
  const config = getBillingPublicConfig();
  try {
    const { getLifetimeSeatStatus } = await import("@/lib/billing/lifetime-seats.server");
    const lifetimeSeats = await getLifetimeSeatStatus();
    return {
      ...config,
      lifetimeSeats,
      lifetimeAvailable: config.lifetimeAvailable && !lifetimeSeats.soldOut,
    };
  } catch (error) {
    console.error("[billing] lifetime seat count failed", error instanceof Error ? error.message : error);
    // Unknown count: show no counter (never a fake number); checkout still re-checks server-side.
    return { ...config, lifetimeSeats: null };
  }
});
