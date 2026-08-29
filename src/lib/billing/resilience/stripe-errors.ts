export class BillingServiceUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(message = "Billing is temporarily unavailable", cause?: unknown) {
    super(message);
    this.name = "BillingServiceUnavailableError";
    this.cause = cause;
  }
}

export function isStripeTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { type?: string; statusCode?: number; code?: string };
  if (err.type === "StripeConnectionError" || err.type === "StripeAPIError") return true;
  if (typeof err.statusCode === "number" && err.statusCode >= 500) return true;
  if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT") return true;
  return false;
}

export function wrapStripeBillingError(error: unknown): BillingServiceUnavailableError {
  if (error instanceof BillingServiceUnavailableError) return error;
  if (isStripeTransientError(error)) {
    return new BillingServiceUnavailableError(
      "Billing is temporarily unavailable. Your Drive is unaffected.",
      error,
    );
  }
  if (error instanceof Error) {
    return new BillingServiceUnavailableError(error.message, error);
  }
  return new BillingServiceUnavailableError(undefined, error);
}
