import type { UserSubscriptionRecord } from "@/lib/billing/subscription-store";
import { evaluateSubscriptionAccess } from "@/lib/billing/subscription-access-policy";

import type { DiscountReservation } from "../types";
import {
  buildRewardDiscountPublicTerms,
  readRewardDiscountConfig,
  resolveCouponIdForPercent,
  type RewardDiscountConfig,
} from "./config";

export type DiscountEligibilityReason =
  | "ok_checkout"
  | "ok_renewal"
  | "feature_disabled"
  | "not_configured"
  | "expired"
  | "already_consumed"
  | "already_applied"
  | "wrong_account"
  | "no_coupon_for_percent"
  | "annual_interval"
  | "not_monthly_active"
  | "past_due"
  | "canceled"
  | "already_subscribed_for_checkout"
  | "not_a_subscriber_for_renewal"
  | "existing_discount"
  | "invoice_finalized"
  | "currency_not_allowed"
  | "below_minimum_amount";

export interface DiscountEligibilityDecision {
  ok: boolean;
  reason: DiscountEligibilityReason;
  discountCase?: "checkout_new_monthly" | "renewal_next_monthly";
  couponId?: string;
  message: string;
  terms: ReturnType<typeof buildRewardDiscountPublicTerms>;
}

function accessInput(sub: UserSubscriptionRecord) {
  return {
    plan: sub.plan,
    status: sub.status,
    ...(sub.cancelAtPeriodEnd !== undefined
      ? { cancelAtPeriodEnd: sub.cancelAtPeriodEnd }
      : {}),
    ...(sub.currentPeriodEnd !== undefined ? { currentPeriodEnd: sub.currentPeriodEnd } : {}),
    pastDueSince: sub.pastDueSince ?? null,
  };
}

export function evaluateReservationExpiry(
  reservation: DiscountReservation,
  nowMs: number,
): DiscountReservation {
  if (
    reservation.status === "reserved" ||
    reservation.status === "pending" ||
    reservation.status === "applied"
  ) {
    if (reservation.expiresAtUtc <= nowMs && reservation.status !== "applied") {
      return { ...reservation, status: "expired" };
    }
  }
  return reservation;
}

/**
 * Eligibility for attaching a reward discount.
 * `path`: checkout = new monthly purchase; renewal = next monthly invoice for active sub.
 */
export function evaluateDiscountEligibility(input: {
  reservation: DiscountReservation;
  accountId: string;
  path: "checkout" | "renewal";
  subscription: UserSubscriptionRecord | null;
  hasExistingStripeDiscount?: boolean;
  invoiceStatus?: "draft" | "open" | "paid" | "void" | "uncollectible" | "none";
  currency?: string | null;
  subtotalCents?: number | null;
  nowMs?: number;
  config?: RewardDiscountConfig;
}): DiscountEligibilityDecision {
  const nowMs = input.nowMs ?? Date.now();
  const config = input.config ?? readRewardDiscountConfig();
  const terms = buildRewardDiscountPublicTerms(config);

  if (!config.enabled) {
    return {
      ok: false,
      reason: "feature_disabled",
      message: "Reward discounts are disabled until configured.",
      terms,
    };
  }
  if (!config.configured) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Reward discount coupons are not configured for this environment.",
      terms,
    };
  }

  if (input.reservation.accountId !== input.accountId) {
    return {
      ok: false,
      reason: "wrong_account",
      message: "This reward belongs to another account.",
      terms,
    };
  }

  const reservation = evaluateReservationExpiry(input.reservation, nowMs);
  if (reservation.status === "expired" || reservation.expiresAtUtc <= nowMs) {
    return { ok: false, reason: "expired", message: "This reward discount has expired.", terms };
  }
  if (reservation.status === "consumed") {
    return {
      ok: false,
      reason: "already_consumed",
      message: "This reward discount was already used on a paid invoice.",
      terms,
    };
  }
  if (reservation.status === "applied" && input.path === "checkout") {
    // Idempotent re-entry for the same checkout path is handled by the service.
    const already: DiscountEligibilityDecision = {
      ok: true,
      reason: "already_applied",
      discountCase: "checkout_new_monthly",
      message: "Discount already applied; awaiting invoice confirmation.",
      terms,
    };
    if (reservation.stripeCouponId) already.couponId = reservation.stripeCouponId;
    return already;
  }

  const couponId = resolveCouponIdForPercent(reservation.discountPercent, config);
  if (!couponId) {
    return {
      ok: false,
      reason: "no_coupon_for_percent",
      message: `No configured Stripe coupon for ${reservation.discountPercent}% off.`,
      terms,
    };
  }

  if (input.hasExistingStripeDiscount) {
    return {
      ok: false,
      reason: "existing_discount",
      message: "An existing Stripe discount takes precedence. Non-stacking policy.",
      terms,
    };
  }

  if (input.currency && config.allowedCurrencies.length > 0) {
    if (!config.allowedCurrencies.includes(input.currency.toLowerCase())) {
      return {
        ok: false,
        reason: "currency_not_allowed",
        message: `Currency ${input.currency} is not eligible for reward discounts.`,
        terms,
      };
    }
  }

  if (
    config.minimumAmountCents != null &&
    input.subtotalCents != null &&
    input.subtotalCents < config.minimumAmountCents
  ) {
    return {
      ok: false,
      reason: "below_minimum_amount",
      message: `Invoice subtotal is below the minimum of ${config.minimumAmountCents} cents.`,
      terms,
    };
  }

  if (input.path === "checkout") {
    if (input.subscription) {
      const access = evaluateSubscriptionAccess(accessInput(input.subscription), nowMs);
      if (access.hasDrivePlusAccess) {
        return {
          ok: false,
          reason: "already_subscribed_for_checkout",
          message:
            "You already have Drive+. Use the renewal reward path for the next monthly payment.",
          terms,
        };
      }
    }
    return {
      ok: true,
      reason: "ok_checkout",
      discountCase: "checkout_new_monthly",
      couponId,
      message:
        "Eligible for one-time percent off on a new Drive+ monthly Checkout. Confirmation requires a paid invoice webhook — not the checkout return URL.",
      terms,
    };
  }

  // Renewal path
  if (!input.subscription) {
    return {
      ok: false,
      reason: "not_a_subscriber_for_renewal",
      message: "No subscription on file. Use Checkout for a new monthly purchase.",
      terms,
    };
  }

  const sub = input.subscription;
  if (sub.interval === "year") {
    return {
      ok: false,
      reason: "annual_interval",
      message: "Monthly reward discounts do not apply to annual subscriptions.",
      terms,
    };
  }
  if (sub.interval !== "month") {
    return {
      ok: false,
      reason: "not_monthly_active",
      message: "Reward discounts apply only to monthly Drive+ billing.",
      terms,
    };
  }
  if (sub.status === "canceled") {
    return {
      ok: false,
      reason: "canceled",
      message: "Canceled subscriptions cannot redeem a renewal discount.",
      terms,
    };
  }
  if (sub.status === "past_due") {
    return {
      ok: false,
      reason: "past_due",
      message: "Past-due accounts cannot target the next regular invoice until payment recovers.",
      terms,
    };
  }

  const access = evaluateSubscriptionAccess(accessInput(sub), nowMs);
  if (!access.hasDrivePlusAccess || sub.status !== "active") {
    return {
      ok: false,
      reason: "not_monthly_active",
      message: "Renewal discounts require an active monthly Drive+ subscription.",
      terms,
    };
  }

  if (input.invoiceStatus === "open" || input.invoiceStatus === "paid") {
    if (config.finalizedInvoiceAlternative === "ineligible") {
      return {
        ok: false,
        reason: "invoice_finalized",
        message:
          "The target invoice is already finalized. Configured alternative: ineligible.",
        terms,
      };
    }
    return {
      ok: false,
      reason: "invoice_finalized",
      message:
        "The target invoice is already finalized. Reservation kept pending for a later draft cycle.",
      terms,
    };
  }

  return {
    ok: true,
    reason: "ok_renewal",
    discountCase: "renewal_next_monthly",
    couponId,
    message:
      "Eligible to discount one clearly identified future monthly invoice. Consumed only after that invoice is paid with the discount.",
    terms,
  };
}

export function computeExpectedInvoiceTotals(
  subtotalCents: number,
  discountPercent: number,
): { discountAmountCents: number; totalCents: number } {
  const discountAmountCents = Math.round((subtotalCents * discountPercent) / 100);
  return {
    discountAmountCents,
    totalCents: Math.max(0, subtotalCents - discountAmountCents),
  };
}
