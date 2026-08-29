import { requireAccountSession } from "@/lib/account/auth-service";

/** Server-side guard for authenticated mutations. */
export function resolveAuthenticatedUserId(sessionToken: string): string {
  return requireAccountSession(sessionToken).userId;
}
