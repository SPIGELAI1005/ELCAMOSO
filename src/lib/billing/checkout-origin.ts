const LOCALHOST_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Comma-separated absolute origins, e.g. https://app.elcamoso.com,http://localhost:5173 */
export function readAllowedCheckoutOrigins(): string[] {
  const raw = process.env.ELCAMOSO_ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function sanitizeCheckoutOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Invalid checkout origin");
  }
  return trimmed;
}

function isProductionDeploy(): boolean {
  return (process.env.ELCAMOSO_ENV ?? process.env.NODE_ENV ?? "development") === "production";
}

/** Reject checkout/portal redirect origins outside deploy allowlist or trusted host. */
export function assertAllowedCheckoutOrigin(
  origin: string,
  trustedHost?: string | null,
): string {
  const sanitized = sanitizeCheckoutOrigin(origin);
  const allowlist = readAllowedCheckoutOrigins();

  if (allowlist.length > 0) {
    if (!allowlist.includes(sanitized)) {
      throw new Error("Checkout origin not allowed");
    }
    return sanitized;
  }

  if (!isProductionDeploy() && LOCALHOST_ORIGIN_RE.test(sanitized)) {
    return sanitized;
  }

  if (trustedHost) {
    try {
      if (new URL(sanitized).host === trustedHost) return sanitized;
    } catch {
      /* invalid URL handled above */
    }
  }

  if (isProductionDeploy()) {
    throw new Error("Checkout origin not allowed");
  }

  return sanitized;
}

export function resolveTrustedHostFromRequest(request: Request): string | null {
  const host = request.headers.get("host")?.trim();
  return host || null;
}
