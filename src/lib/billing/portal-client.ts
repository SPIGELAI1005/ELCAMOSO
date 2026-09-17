import { createBillingPortalSessionFn } from "@/lib/billing/server-fns";

export async function openBillingPortal(returnPath = "/settings"): Promise<void> {
  const result = await createBillingPortalSessionFn({
    data: {
      sessionToken: null,
      origin: window.location.origin,
      returnPath,
    },
  });
  window.location.assign(result.url);
}
