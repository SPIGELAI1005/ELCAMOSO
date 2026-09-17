import { createServerFn } from "@tanstack/react-start";

export const getEntitlementsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const { tryResolveRequestSessionToken } = await import(
      "@/lib/account/session-cookies.server"
    );
    return resolveEntitlementSnapshot({
      sessionToken: tryResolveRequestSessionToken(data.sessionToken),
    });
  });
