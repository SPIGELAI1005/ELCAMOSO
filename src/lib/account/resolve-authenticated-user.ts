import { requireAccountSession } from "@/lib/account/auth-service";
import { resolveRequestSessionToken } from "@/lib/account/session-request";

/**
 * Server-side guard for authenticated mutations.
 * Prefer resolving the HttpOnly cookie in the caller via `session-cookies.server`
 * and passing the ticket explicitly when available.
 */
export function resolveAuthenticatedUserId(sessionToken?: string | null): string {
  const token = resolveRequestSessionToken(sessionToken);
  return requireAccountSession(token).userId;
}
