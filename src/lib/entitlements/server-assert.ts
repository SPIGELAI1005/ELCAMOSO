import {
  EntitlementDeniedError,
  requireEntitlement,
} from "@/lib/entitlements/service";
import type { Entitlement } from "@/lib/entitlements/types";
import { tryResolveRequestSessionToken } from "@/lib/account/session-request";

/** Server-side entitlement guard for premium endpoints. */
export async function assertServerEntitlement(
  sessionToken: string | null | undefined,
  entitlement: Entitlement,
): Promise<void> {
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
