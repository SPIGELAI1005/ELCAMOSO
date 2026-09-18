import type { Plan } from "@/lib/entitlements/types";
import type { BillingInterval } from "@/lib/billing/status";
import {
  getCommercialPlan,
  parseCommercialPlanId,
  type CommercialPlanId,
} from "@/lib/billing/stripe/plans";

/** Client-facing plan slug - never a Stripe Price id. */
export type CheckoutPlanSlug = "drive_plus";

/** Client-facing billing interval slug. */
export type CheckoutIntervalSlug = "monthly" | "yearly";

export const CHECKOUT_PLAN_SLUGS: readonly CheckoutPlanSlug[] = ["drive_plus"] as const;
export const CHECKOUT_INTERVAL_SLUGS: readonly CheckoutIntervalSlug[] = [
  "monthly",
  "yearly",
] as const;

export interface CheckoutPlanRequest {
  plan: CheckoutPlanSlug;
  interval: CheckoutIntervalSlug;
  returnPath?: string;
  source?: string;
  /** Tesla QR upgrade - links checkout to in-car unlock broadcast. */
  upgradeToken?: string;
}

export function parseCheckoutPlanSlug(value: string): CheckoutPlanSlug | null {
  return CHECKOUT_PLAN_SLUGS.includes(value as CheckoutPlanSlug)
    ? (value as CheckoutPlanSlug)
    : null;
}

export function parseCheckoutIntervalSlug(value: string): CheckoutIntervalSlug | null {
  return CHECKOUT_INTERVAL_SLUGS.includes(value as CheckoutIntervalSlug)
    ? (value as CheckoutIntervalSlug)
    : null;
}

export function checkoutIntervalToBillingInterval(interval: CheckoutIntervalSlug): BillingInterval {
  return interval === "monthly" ? "month" : "year";
}

/** Maps client plan + interval to internal commercial plan id. */
export function resolveCommercialPlanId(
  plan: CheckoutPlanSlug,
  interval: CheckoutIntervalSlug,
): CommercialPlanId | null {
  if (plan !== "drive_plus") return null;
  return interval === "monthly" ? "drive_plus_monthly" : "drive_plus_yearly";
}

export function parseCheckoutPlanRequest(body: unknown): CheckoutPlanRequest | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const plan = typeof record["plan"] === "string" ? parseCheckoutPlanSlug(record["plan"]) : null;
  const interval =
    typeof record["interval"] === "string" ? parseCheckoutIntervalSlug(record["interval"]) : null;
  if (!plan || !interval) return null;

  const returnPath =
    typeof record["returnPath"] === "string" && record["returnPath"].trim()
      ? record["returnPath"].trim()
      : undefined;
  const source =
    typeof record["source"] === "string" && record["source"].trim()
      ? record["source"].trim()
      : undefined;
  const upgradeToken =
    typeof record["upgradeToken"] === "string" && record["upgradeToken"].trim()
      ? record["upgradeToken"].trim()
      : undefined;

  return {
    plan,
    interval,
    ...(returnPath ? { returnPath } : {}),
    ...(source ? { source } : {}),
    ...(upgradeToken ? { upgradeToken } : {}),
  };
}

export function describeCheckoutPlan(
  plan: CheckoutPlanSlug,
  interval: CheckoutIntervalSlug,
): {
  commercialPlanId: CommercialPlanId;
  entitlementPlan: Plan;
  billingInterval: BillingInterval;
  label: string;
} {
  const commercialPlanId = resolveCommercialPlanId(plan, interval);
  if (!commercialPlanId) {
    throw new Error("Unknown plan");
  }
  const commercial = getCommercialPlan(commercialPlanId);
  return {
    commercialPlanId,
    entitlementPlan: commercial.plan,
    billingInterval: commercial.interval,
    label: commercial.label,
  };
}

export { parseCommercialPlanId };
