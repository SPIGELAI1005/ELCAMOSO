import { createBillingPortalSessionFn } from "@/lib/billing/server-fns";

export async function openBillingPortal(
  sessionToken: string,
  returnPath = "/settings",
): Promise<void> {
  const result = await createBillingPortalSessionFn({
    data: {
      sessionToken,
      origin: window.location.origin,
      returnPath,
    },
  });
  window.location.assign(result.url);
}
