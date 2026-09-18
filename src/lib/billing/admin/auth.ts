import { timingSafeEqual } from "node:crypto";

export class BillingAdminAccessDeniedError extends Error {
  constructor(message = "Billing admin access denied") {
    super(message);
    this.name = "BillingAdminAccessDeniedError";
  }
}

export function isBillingAdminConfigured(): boolean {
  const secret = process.env["ELCAMOSO_BILLING_ADMIN_SECRET"]?.trim();
  return Boolean(secret);
}

function readConfiguredSecret(): string {
  const secret = process.env["ELCAMOSO_BILLING_ADMIN_SECRET"]?.trim();
  if (!secret) {
    throw new BillingAdminAccessDeniedError("Billing admin is not configured");
  }
  return secret;
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Server-only guard - required for all admin billing diagnostics and reconciliation. */
export function assertBillingAdminAccess(providedSecret: string | null | undefined): void {
  const expected = readConfiguredSecret();
  const provided = providedSecret?.trim() ?? "";
  if (!provided || !secretsMatch(provided, expected)) {
    throw new BillingAdminAccessDeniedError();
  }
}
