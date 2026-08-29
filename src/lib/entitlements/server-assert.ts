import {
  EntitlementDeniedError,
  requireEntitlement,
} from "@/lib/entitlements/service";
import type { Entitlement } from "@/lib/entitlements/types";

/** Server-side entitlement guard for premium endpoints. */
export async function assertServerEntitlement(
  sessionToken: string | null | undefined,
  entitlement: Entitlement,
): Promise<void> {
  try {
    await requireEntitlement({ sessionToken, entitlement });
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      throw new Error("Access denied");
    }
    throw error;
  }
}
