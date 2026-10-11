/**
 * Internal post-login redirect allowlist.
 * Never trust an open redirect from the client.
 */

const ALLOWED_PATH_PREFIXES = [
  "/drive",
  "/settings",
  "/garage",
  "/sounds",
  "/studio",
  "/explore",
  "/demo",
  "/onboarding",
  "/symphony",
  "/worlds",
  "/fusion",
  "/calibrate",
  "/story",
  "/science",
  "/pricing",
  "/account",
  "/auth/account",
  "/legal",
] as const;

const DEFAULT_RETURN_TO = "/drive";

export function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo || typeof returnTo !== "string") return DEFAULT_RETURN_TO;
  const trimmed = returnTo.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return DEFAULT_RETURN_TO;
  }
  // Block protocol / host tricks in the path.
  if (/^[a-zA-Z][a-zA-Z+\-.]*:/.test(trimmed)) return DEFAULT_RETURN_TO;

  let pathname = trimmed;
  let search = "";
  const q = trimmed.indexOf("?");
  if (q >= 0) {
    pathname = trimmed.slice(0, q);
    search = trimmed.slice(q);
  }
  const hash = pathname.indexOf("#");
  if (hash >= 0) pathname = pathname.slice(0, hash);

  if (pathname === "/") return `/${search}`;

  const allowed = ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!allowed) return DEFAULT_RETURN_TO;

  // Keep query strings for known internal flows (e.g. activateTrial) - still same-origin path.
  return `${pathname}${search}`;
}

export function isAllowedReturnTo(returnTo: string): boolean {
  const trimmed = returnTo.trim();
  return sanitizeReturnTo(trimmed) === trimmed;
}
