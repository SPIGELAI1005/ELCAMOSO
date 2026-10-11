import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import type { UserSubscriptionRecord } from "@/lib/billing/subscription-store";

import { getDiscountReservation, upsertDiscountReservation } from "../store";
import type { DiscountReservation } from "../types";
import {
  buildRewardDiscountPublicTerms,
  readRewardDiscountConfig,
} from "./config";
import {
  computeExpectedInvoiceTotals,
  evaluateDiscountEligibility,
  evaluateReservationExpiry,
} from "./policy";
import { getRewardDiscountStripeOps } from "./stripe-ops";

function applyIdemKey(reservationId: string, op: string): string {
  return `reward-discount:${reservationId}:${op}`;
}

function patchReservation(
  current: DiscountReservation,
  patch: Partial<DiscountReservation>,
): DiscountReservation {
  const next = { ...current, ...patch };
  // exactOptionalPropertyTypes: drop undefined optionals from patch by rebuild
  return upsertDiscountReservation(next);
}

export function getRewardDiscountTerms() {
  return buildRewardDiscountPublicTerms();
}

export function previewRewardDiscount(input: {
  accountId: string;
  reservationId: string;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const config = readRewardDiscountConfig();
  const terms = buildRewardDiscountPublicTerms(config);
  const reservation = getDiscountReservation(input.reservationId);
  if (!reservation || reservation.accountId !== input.accountId) {
    return {
      ok: false as const,
      error: "not_found" as const,
      message: "Reward discount not found for this account.",
      terms,
    };
  }
  const fresh = evaluateReservationExpiry(reservation, nowMs);
  if (fresh.status !== reservation.status) {
    upsertDiscountReservation(fresh);
  }
  const subscription = getSubscriptionForUser(input.accountId);
  const checkout = evaluateDiscountEligibility({
    reservation: fresh,
    accountId: input.accountId,
    path: "checkout",
    subscription,
    nowMs,
    config,
  });
  const renewal = evaluateDiscountEligibility({
    reservation: fresh,
    accountId: input.accountId,
    path: "renewal",
    subscription,
    nowMs,
    config,
  });

  return {
    ok: true as const,
    reservation: {
      reservationId: fresh.reservationId,
      discountPercent: fresh.discountPercent,
      status: fresh.status,
      expiresAtUtc: new Date(fresh.expiresAtUtc).toISOString(),
      discountCase: fresh.discountCase,
      stripeInvoiceId: fresh.stripeInvoiceId,
    },
    checkout,
    renewal,
    terms,
  };
}

/**
 * Attach discount to Checkout Session params for a verified non-subscriber.
 * Returns coupon id + metadata; does not mark consumed.
 */
export function prepareCheckoutRewardDiscount(input: {
  accountId: string;
  reservationId: string;
  interval: "monthly" | "yearly";
  nowMs?: number;
}):
  | {
      ok: true;
      couponId: string;
      reservation: DiscountReservation;
      metadata: Record<string, string>;
    }
  | { ok: false; error: string; message: string } {
  const nowMs = input.nowMs ?? Date.now();
  if (input.interval !== "monthly") {
    return {
      ok: false,
      error: "annual_interval",
      message: "Reward discounts apply only to monthly Drive+ Checkout.",
    };
  }
  const reservation = getDiscountReservation(input.reservationId);
  if (!reservation) {
    return { ok: false, error: "not_found", message: "Reward discount not found." };
  }
  const subscription = getSubscriptionForUser(input.accountId);
  const decision = evaluateDiscountEligibility({
    reservation,
    accountId: input.accountId,
    path: "checkout",
    subscription,
    nowMs,
  });
  if (!decision.ok || !decision.couponId) {
    if (decision.reason === "already_applied" && reservation.stripeCouponId) {
      return {
        ok: true,
        couponId: reservation.stripeCouponId,
        reservation,
        metadata: {
          rewardReservationId: reservation.reservationId,
          rewardDiscountPercent: String(reservation.discountPercent),
        },
      };
    }
    return { ok: false, error: decision.reason, message: decision.message };
  }

  const updated = patchReservation(reservation, {
    status: "applied",
    discountCase: "checkout_new_monthly",
    stripeCouponId: decision.couponId,
    applyIdempotencyKey: applyIdemKey(reservation.reservationId, "checkout"),
    appliedAtUtc: nowMs,
  });

  return {
    ok: true,
    couponId: decision.couponId,
    reservation: updated,
    metadata: {
      rewardReservationId: reservation.reservationId,
      rewardDiscountPercent: String(reservation.discountPercent),
    },
  };
}

export function bindCheckoutSessionToReservation(input: {
  reservationId: string;
  accountId: string;
  checkoutSessionId: string;
  stripeCustomerId: string;
}): void {
  const reservation = getDiscountReservation(input.reservationId);
  if (!reservation || reservation.accountId !== input.accountId) return;
  patchReservation(reservation, {
    stripeCheckoutSessionId: input.checkoutSessionId,
    stripeCustomerId: input.stripeCustomerId,
    status: reservation.status === "reserved" ? "applied" : reservation.status,
  });
}

/**
 * Apply reward to one clearly identified future monthly invoice for an active subscriber.
 */
export async function applyRenewalRewardDiscount(input: {
  accountId: string;
  reservationId: string;
  /** Ignored if posted — ownership comes from billing repository. */
  postedCustomerId?: string | null;
  nowMs?: number;
}): Promise<
  | {
      ok: true;
      reservation: DiscountReservation;
      expected: {
        subtotalCents: number | null;
        discountAmountCents: number | null;
        totalCents: number | null;
        currency: string | null;
        targetInvoiceId: string | null;
      };
      message: string;
    }
  | { ok: false; error: string; message: string; reservation?: DiscountReservation }
> {
  const nowMs = input.nowMs ?? Date.now();
  const config = readRewardDiscountConfig();
  const reservation = getDiscountReservation(input.reservationId);
  if (!reservation) {
    return { ok: false, error: "not_found", message: "Reward discount not found." };
  }
  if (reservation.accountId !== input.accountId) {
    return { ok: false, error: "wrong_account", message: "Reward belongs to another account." };
  }

  // Never trust posted customer IDs.
  const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(input.accountId);
  if (!stripeCustomerId) {
    return { ok: false, error: "no_customer", message: "No Stripe customer linked to this account." };
  }
  if (input.postedCustomerId && input.postedCustomerId !== stripeCustomerId) {
    return {
      ok: false,
      error: "customer_mismatch",
      message: "Posted customer id does not match the verified account customer.",
    };
  }

  const billingSub = await getSubscriptionRepository().findLatestByUserId?.(input.accountId);
  const runtimeSub = getSubscriptionForUser(input.accountId);
  const subscription: UserSubscriptionRecord | null =
    runtimeSub ??
    (billingSub
      ? {
          userId: billingSub.userId,
          plan: billingSub.plan,
          status: billingSub.status,
          interval: billingSub.interval,
          cancelAtPeriodEnd: billingSub.cancelAtPeriodEnd,
          currentPeriodEnd: billingSub.currentPeriodEnd,
        }
      : null);
  if (!billingSub?.providerSubscriptionId) {
    return {
      ok: false,
      error: "not_a_subscriber_for_renewal",
      message: "No active subscription id on file.",
    };
  }

  // Idempotent: already applied/consumed
  if (reservation.status === "consumed") {
    return {
      ok: false,
      error: "already_consumed",
      message: "Already consumed on a paid invoice.",
      reservation,
    };
  }
  if (reservation.status === "applied" && reservation.discountCase === "renewal_next_monthly") {
    return {
      ok: true,
      reservation,
      expected: {
        subtotalCents: reservation.expectedSubtotalCents ?? null,
        discountAmountCents: reservation.expectedDiscountAmountCents ?? null,
        totalCents: reservation.expectedInvoiceTotalCents ?? null,
        currency: null,
        targetInvoiceId: reservation.stripeInvoiceId ?? null,
      },
      message: "Discount already applied; awaiting paid invoice confirmation.",
    };
  }

  const ops = getRewardDiscountStripeOps();
  let preview;
  try {
    preview = await ops.createInvoicePreview({
      customerId: stripeCustomerId,
      subscriptionId: billingSub.providerSubscriptionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "preview_failed";
    const failed = patchReservation(reservation, { status: "failed", lastError: message });
    return { ok: false, error: "preview_failed", message, reservation: failed };
  }

  const invoiceStatus =
    preview.status === "draft" ||
    preview.status === "open" ||
    preview.status === "paid" ||
    preview.status === "void" ||
    preview.status === "uncollectible"
      ? preview.status
      : "none";

  const decision = evaluateDiscountEligibility({
    reservation,
    accountId: input.accountId,
    path: "renewal",
    subscription,
    hasExistingStripeDiscount: preview.discountCount > 0,
    invoiceStatus,
    currency: preview.currency,
    subtotalCents: preview.subtotal,
    nowMs,
    config,
  });

  if (!decision.ok || !decision.couponId) {
    if (decision.reason === "invoice_finalized" && config.finalizedInvoiceAlternative === "pending") {
      const pendingBase: DiscountReservation = {
        ...reservation,
        status: "pending",
        ineligibleReason: decision.reason,
        lastError: decision.message,
        stripeCustomerId,
        stripeSubscriptionId: billingSub.providerSubscriptionId,
      };
      if (preview.id) pendingBase.stripeInvoiceId = preview.id;
      const pending = upsertDiscountReservation(pendingBase);
      return { ok: false, error: decision.reason, message: decision.message, reservation: pending };
    }
    const ineligible = patchReservation(reservation, {
      status: decision.reason === "expired" ? "expired" : "ineligible",
      ineligibleReason: decision.reason,
      lastError: decision.message,
    });
    return { ok: false, error: decision.reason, message: decision.message, reservation: ineligible };
  }

  const idempotencyKey = applyIdemKey(reservation.reservationId, "renewal-apply");
  let updatedSub;
  try {
    updatedSub = await ops.updateSubscriptionDiscounts({
      subscriptionId: billingSub.providerSubscriptionId,
      couponId: decision.couponId,
      idempotencyKey,
      metadata: {
        rewardReservationId: reservation.reservationId,
        rewardDiscountPercent: String(reservation.discountPercent),
        elcamosoUserId: input.accountId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "stripe_update_failed";
    // Timeout / crash recovery: leave reserved so retry with same idempotency key is safe.
    const failed = patchReservation(reservation, {
      status: "failed",
      lastError: message,
      applyIdempotencyKey: idempotencyKey,
      stripeCustomerId,
      stripeSubscriptionId: billingSub.providerSubscriptionId,
    });
    return { ok: false, error: "stripe_update_failed", message, reservation: failed };
  }

  const expected =
    preview.subtotal != null
      ? computeExpectedInvoiceTotals(preview.subtotal, reservation.discountPercent)
      : null;

  const discountId =
    Array.isArray(updatedSub.discounts) && updatedSub.discounts[0]
      ? typeof updatedSub.discounts[0] === "string"
        ? updatedSub.discounts[0]
        : ((updatedSub.discounts[0] as { id?: string }).id ?? undefined)
      : undefined;

  const appliedBase: DiscountReservation = {
    ...reservation,
    status: "applied",
    discountCase: "renewal_next_monthly",
    stripeCustomerId,
    stripeCouponId: decision.couponId,
    stripeSubscriptionId: billingSub.providerSubscriptionId,
    applyIdempotencyKey: idempotencyKey,
    appliedAtUtc: nowMs,
  };
  if (preview.id) appliedBase.stripeInvoiceId = preview.id;
  if (discountId) appliedBase.stripeDiscountId = discountId;
  if (preview.subtotal != null) appliedBase.expectedSubtotalCents = preview.subtotal;
  if (expected) {
    appliedBase.expectedDiscountAmountCents = expected.discountAmountCents;
    appliedBase.expectedInvoiceTotalCents = expected.totalCents;
  }
  delete appliedBase.lastError;
  delete appliedBase.ineligibleReason;
  const applied = upsertDiscountReservation(appliedBase);

  return {
    ok: true,
    reservation: applied,
    expected: {
      subtotalCents: preview.subtotal,
      discountAmountCents: expected?.discountAmountCents ?? null,
      totalCents: expected?.totalCents ?? null,
      currency: preview.currency,
      targetInvoiceId: preview.id,
    },
    message:
      "Discount applied to the subscription for the next eligible monthly invoice. Not consumed until that invoice is paid.",
  };
}

/**
 * Retry a failed apply using the same idempotency key (crash recovery).
 */
export async function retryApplyRenewalRewardDiscount(input: {
  accountId: string;
  reservationId: string;
  nowMs?: number;
}) {
  const reservation = getDiscountReservation(input.reservationId);
  if (!reservation || reservation.accountId !== input.accountId) {
    return { ok: false as const, error: "not_found", message: "Not found." };
  }
  if (reservation.status === "applied" || reservation.status === "consumed") {
    return { ok: true as const, reservation, reused: true as const };
  }
  if (reservation.status !== "failed" && reservation.status !== "pending") {
    return {
      ok: false as const,
      error: "not_retryable",
      message: `Status ${reservation.status} is not retryable.`,
    };
  }
  // Reset failed → reserved for re-entry; Stripe idempotency key stays stable.
  if (reservation.status === "failed") {
    const reset: DiscountReservation = { ...reservation, status: "reserved" };
    delete reset.lastError;
    upsertDiscountReservation(reset);
  }
  return applyRenewalRewardDiscount(input);
}
