import { requireAccountSession } from "@/lib/account/auth-service";
import { resolveRequestSessionToken } from "@/lib/account/session-request";

/** Server-side guard for authenticated mutations. Resolves HttpOnly cookie when token omitted. */
export function resolveAuthenticatedUserId(sessionToken?: string | null): string {
  const token = resolveRequestSessionToken(sessionToken);
  return requireAccountSession(token).userId;
}
