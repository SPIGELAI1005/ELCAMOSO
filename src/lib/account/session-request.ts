/**
 * Client-safe token helper: explicit bearer/header tokens only.
 * HttpOnly cookie resolution lives in `session-cookies.server.ts` (server handlers).
 */
export function tryResolveRequestSessionToken(explicit?: string | null): string | null {
  const fromExplicit = explicit?.trim();
  return fromExplicit || null;
}

export function resolveRequestSessionToken(explicit?: string | null): string {
  const token = tryResolveRequestSessionToken(explicit);
  if (!token) throw new Error("Authentication required");
  return token;
}
