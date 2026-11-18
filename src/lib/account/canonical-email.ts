/**
 * Shared email identity helpers. Keep this module free of server/DB imports
 * so account, admin and client-safe code can all use the same rules.
 */

/** Trim and lower-case. Does not alias provider domains. */
export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Canonical form used to decide whether two addresses are the same person.
 * Gmail treats googlemail.com as an alias of gmail.com; we do the same.
 * Dots and plus-tags are left as-is (not part of this fix).
 */
export function canonicalAccountEmail(email: string): string {
  const normalized = normalizeAccountEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 1) return normalized;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const canonDomain = domain === "googlemail.com" ? "gmail.com" : domain;
  return `${local}@${canonDomain}`;
}

/** Every stored spelling we should match for a given address (canonical first). */
export function emailLookupAliases(email: string): string[] {
  const canonical = canonicalAccountEmail(email);
  const at = canonical.lastIndexOf("@");
  if (at < 1) return [canonical];
  const local = canonical.slice(0, at);
  const domain = canonical.slice(at + 1);
  if (domain === "gmail.com") {
    return uniqueNonEmpty([canonical, `${local}@googlemail.com`]);
  }
  return [canonical];
}

export function emailsAreSameAccount(a: string, b: string): boolean {
  const left = canonicalAccountEmail(a);
  const right = canonicalAccountEmail(b);
  return left.length > 0 && left === right;
}

function uniqueNonEmpty(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
