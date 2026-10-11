import { resolveStripePriceId, readStripeConfig } from "@/lib/billing/stripe/config";

import { isRewardDiscountsEnabled } from "./flag";

export type FinalizedInvoiceAlternative = "pending" | "ineligible";

export interface RewardDiscountConfig {
  enabled: boolean;
  configured: boolean;
  /** Map percent off → Stripe Coupon id (test-mode coupons created by operator). */
  couponIdsByPercent: Map<number, string>;
  /** Allowed ISO currencies for amount checks (empty = any currency on the Drive+ price). */
  allowedCurrencies: string[];
  /** Only monthly Drive+ is eligible. */
  eligibleInterval: "month";
  /** Commercial price scope. */
  eligibleCommercialPlanId: "drive_plus_monthly";
  monthlyPriceId: string;
  /**
   * When the targeted upcoming invoice is already finalized/open:
   * - pending: keep reservation for a later draft cycle (do not attach blindly)
   * - ineligible: close out with a truthful reason
   */
  finalizedInvoiceAlternative: FinalizedInvoiceAlternative;
  /** Optional minimum invoice subtotal (cents) before a percent discount may apply. */
  minimumAmountCents: number | null;
  /** Non-stacking: refuse when subscription/invoice already has a discount. */
  nonStacking: true;
  /** Existing discount always wins. */
  existingDiscountPrecedence: "existing_wins";
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseCouponMap(): Map<number, string> {
  const map = new Map<number, string>();
  // Explicit percent keys — never invent coupon objects at runtime.
  const pairs: Array<[number, string]> = [
    [15, "STRIPE_REWARD_COUPON_PERCENT_15"],
    [20, "STRIPE_REWARD_COUPON_PERCENT_20"],
  ];
  for (const [percent, envName] of pairs) {
    const id = readEnv(envName);
    if (id) map.set(percent, id);
  }
  // Optional JSON map: {"10":"coupon_xxx","25":"coupon_yyy"}
  const json = readEnv("STRIPE_REWARD_COUPON_PERCENT_MAP");
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed)) {
        const percent = Number(k);
        if (Number.isFinite(percent) && typeof v === "string" && v.trim()) {
          map.set(percent, v.trim());
        }
      }
    } catch {
      /* ignore malformed map — configured stays false if empty */
    }
  }
  return map;
}

function parseCurrencies(): string[] {
  const raw = readEnv("ELCAMOSO_REWARD_DISCOUNT_CURRENCIES");
  if (!raw) return [];
  return raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

function parseFinalizedAlternative(): FinalizedInvoiceAlternative {
  const raw = readEnv("ELCAMOSO_REWARD_DISCOUNT_FINALIZED_ALTERNATIVE")?.toLowerCase();
  return raw === "ineligible" ? "ineligible" : "pending";
}

function parseMinAmount(): number | null {
  const raw = readEnv("ELCAMOSO_REWARD_DISCOUNT_MIN_AMOUNT_CENTS");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function readRewardDiscountConfig(): RewardDiscountConfig {
  const enabled = isRewardDiscountsEnabled();
  const couponIdsByPercent = parseCouponMap();
  const stripe = readStripeConfig();
  let monthlyPriceId = "";
  try {
    monthlyPriceId = resolveStripePriceId("drive_plus_monthly", stripe);
  } catch {
    monthlyPriceId = stripe.prices.drive_plus_monthly;
  }

  const configured =
    enabled &&
    stripe.configured &&
    couponIdsByPercent.size > 0 &&
    Boolean(monthlyPriceId);

  return {
    enabled,
    configured,
    couponIdsByPercent,
    allowedCurrencies: parseCurrencies(),
    eligibleInterval: "month",
    eligibleCommercialPlanId: "drive_plus_monthly",
    monthlyPriceId,
    finalizedInvoiceAlternative: parseFinalizedAlternative(),
    minimumAmountCents: parseMinAmount(),
    nonStacking: true,
    existingDiscountPrecedence: "existing_wins",
  };
}

export function resolveCouponIdForPercent(
  percent: number,
  config: RewardDiscountConfig = readRewardDiscountConfig(),
): string | null {
  return config.couponIdsByPercent.get(percent) ?? null;
}

/** Public terms shown before redemption — no secret values. */
export function buildRewardDiscountPublicTerms(
  config: RewardDiscountConfig = readRewardDiscountConfig(),
): {
  available: boolean;
  eligibleInterval: "month";
  eligiblePlan: "Drive+ monthly";
  currenciesNote: string;
  nonStacking: true;
  existingDiscountPrecedence: "existing_wins";
  annualSubscribers: "ineligible";
  cancelledOrPastDue: "ineligible";
  checkoutReturnDoesNotConsume: true;
  finalizedInvoiceAlternative: FinalizedInvoiceAlternative;
  minimumAmountCents: number | null;
  configuredPercents: number[];
} {
  return {
    available: config.configured,
    eligibleInterval: "month",
    eligiblePlan: "Drive+ monthly",
    currenciesNote:
      config.allowedCurrencies.length > 0
        ? `Limited to currencies: ${config.allowedCurrencies.join(", ").toUpperCase()}.`
        : "Currency follows the configured Drive+ monthly Stripe Price.",
    nonStacking: true,
    existingDiscountPrecedence: "existing_wins",
    annualSubscribers: "ineligible",
    cancelledOrPastDue: "ineligible",
    checkoutReturnDoesNotConsume: true,
    finalizedInvoiceAlternative: config.finalizedInvoiceAlternative,
    minimumAmountCents: config.minimumAmountCents,
    configuredPercents: [...config.couponIdsByPercent.keys()].sort((a, b) => a - b),
  };
}
