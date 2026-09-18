import { EntitlementDeniedError, requireEntitlement } from "@/lib/entitlements/service";
import type { Entitlement } from "@/lib/entitlements/types";

/** Server-side entitlement guard for premium endpoints. */
export async function assertServerEntitlement(
  sessionToken: string | null | undefined,
  entitlement: Entitlement,
): Promise<void> {
  const { tryResolveRequestSessionToken } = await import("@/lib/account/session-cookies.server");
  const token = tryResolveRequestSessionToken(sessionToken);
  try {
    await requireEntitlement({ sessionToken: token, entitlement });
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      throw new Error("Access denied");
    }
    throw error;
  }
}
