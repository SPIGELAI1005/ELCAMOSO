import { createBillingPortalSessionFn } from "@/lib/billing/server-fns";

export async function openBillingPortal(returnPath = "/settings", flow?: "cancel"): Promise<void> {
  const result = await createBillingPortalSessionFn({
    data: {
      sessionToken: null,
      origin: window.location.origin,
      returnPath,
      ...(flow ? { flow } : {}),
    },
  });
  window.location.assign(result.url);
}
