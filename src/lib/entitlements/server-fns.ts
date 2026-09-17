import { createServerFn } from "@tanstack/react-start";

import { tryResolveRequestSessionToken } from "@/lib/account/session-request";

export const getEntitlementsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    return resolveEntitlementSnapshot({
      sessionToken: tryResolveRequestSessionToken(data.sessionToken),
    });
  });
