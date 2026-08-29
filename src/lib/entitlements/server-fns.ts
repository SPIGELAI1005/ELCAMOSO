import { createServerFn } from "@tanstack/react-start";

export const getEntitlementsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken?: string | null }) => data)
  .handler(async ({ data }) => {
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    return resolveEntitlementSnapshot({ sessionToken: data.sessionToken ?? null });
  });
