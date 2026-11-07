import { sanitizeReturnTo } from "@/lib/account/return-to";
import {
  parseCheckoutIntervalSlug,
  parseCheckoutPlanSlug,
  type CheckoutIntervalSlug,
  type CheckoutPlanSlug,
} from "@/lib/billing/checkout-request";

export interface CheckoutResumeIntent {
  plan: CheckoutPlanSlug;
  interval: CheckoutIntervalSlug;
  source: string;
  /** Page to return to after Checkout, without the resume query. */
  returnPath: string;
}

function cleanSource(source: string): string {
  const cleaned = source.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  return cleaned || "pricing";
}

/** Sign-in return path that reopens the package the visitor just chose. */
export function checkoutResumeReturnTo(
  returnTo: string,
  intent: { plan: CheckoutPlanSlug; interval: CheckoutIntervalSlug; source: string },
): string {
  const safe = sanitizeReturnTo(returnTo);
  const q = safe.indexOf("?");
  const path = q >= 0 ? safe.slice(0, q) : safe;
  const params = new URLSearchParams(q >= 0 ? safe.slice(q + 1) : "");
  params.set("checkout", intent.plan);
  params.set("interval", intent.interval);
  params.set("source", cleanSource(intent.source));
  return sanitizeReturnTo(`${path}?${params.toString()}`);
}

/** Read a pending purchase from a same-origin path, including its query string. */
export function readCheckoutResume(pathWithSearch: string): CheckoutResumeIntent | null {
  const safe = sanitizeReturnTo(pathWithSearch);
  const q = safe.indexOf("?");
  if (q < 0) return null;
  const path = safe.slice(0, q);
  const params = new URLSearchParams(safe.slice(q + 1));
  const plan = parseCheckoutPlanSlug(params.get("checkout") ?? "");
  const interval = parseCheckoutIntervalSlug(params.get("interval") ?? "");
  if (!plan || !interval) return null;
  const source = cleanSource(params.get("source") ?? "pricing");
  params.delete("checkout");
  params.delete("interval");
  params.delete("source");
  const rest = params.toString();
  return {
    plan,
    interval,
    source,
    returnPath: sanitizeReturnTo(rest ? `${path}?${rest}` : path || "/"),
  };
}
