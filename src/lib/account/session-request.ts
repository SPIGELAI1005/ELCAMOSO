import { getCookie } from "@tanstack/react-start/server";

import { ACCOUNT_SESSION_COOKIE_NAME } from "@/lib/account/session-cookie";

/** Prefer an explicit token (tests / legacy); otherwise read the HttpOnly session cookie. */
export function tryResolveRequestSessionToken(explicit?: string | null): string | null {
  const fromExplicit = explicit?.trim();
  if (fromExplicit) return fromExplicit;
  try {
    const fromCookie = getCookie(ACCOUNT_SESSION_COOKIE_NAME)?.trim();
    if (fromCookie) return fromCookie;
  } catch {
    // Outside a request context (unit tests), cookie APIs are unavailable.
  }
  return null;
}

export function resolveRequestSessionToken(explicit?: string | null): string {
  const token = tryResolveRequestSessionToken(explicit);
  if (!token) throw new Error("Authentication required");
  return token;
}
