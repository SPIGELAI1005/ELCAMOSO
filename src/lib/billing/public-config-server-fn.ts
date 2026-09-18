import { createServerFn } from "@tanstack/react-start";

import { getBillingPublicConfig } from "@/lib/billing/public-config";

/** Client-safe entry - no auth/Stripe handler imports. */
export const getBillingPublicConfigFn = createServerFn({ method: "POST" }).handler(() =>
  getBillingPublicConfig(),
);
