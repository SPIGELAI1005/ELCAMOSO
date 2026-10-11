import type Stripe from "stripe";

import { stripeCustomerId, stripeSubscriptionId } from "@/lib/billing/stripe/normalize";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";

import {
  getDiscountReservation,
  listDiscountReservationsForAccount,
  upsertDiscountReservation,
} from "../store";
import type { DiscountReservation } from "../types";

function invoiceHasCoupon(
  invoice: Stripe.Invoice,
  couponId: string | undefined,
): boolean {
  if (!couponId) return false;
  const discounts = invoice.discounts;
  if (!Array.isArray(discounts)) return false;
  for (const d of discounts) {
    if (!d || typeof d === "string") continue;
    const raw = d as { coupon?: string | { id?: string } | null };
    const coupon = raw.coupon;
    if (!coupon) continue;
    const id = typeof coupon === "string" ? coupon : coupon.id;
    if (id === couponId) return true;
  }
  const metaCoupon = invoice.metadata?.["rewardCouponId"];
  if (metaCoupon === couponId) return true;
  return false;
}

function reservationIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const fromMeta = invoice.metadata?.["rewardReservationId"];
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const parentSub = invoice.parent?.subscription_details?.metadata?.["rewardReservationId"];
  if (typeof parentSub === "string" && parentSub.trim()) return parentSub.trim();
  return null;
}

/**
 * Mark consumed only when a paid invoice proves the discount.
 * Checkout return URLs and successful apply API calls are not sufficient.
 */
export async function reconcileRewardDiscountFromPaidInvoice(
  invoice: Stripe.Invoice,
): Promise<{ updated: boolean; reservationId?: string; reason?: string }> {
  if (invoice.status !== "paid") {
    return { updated: false, reason: "invoice_not_paid" };
  }

  const customerId = stripeCustomerId(invoice.customer);
  if (!customerId) return { updated: false, reason: "no_customer" };

  const accountId = await getUserBillingRepository().getUserIdByStripeCustomerId(customerId);
  if (!accountId) return { updated: false, reason: "unknown_customer" };

  let reservation: DiscountReservation | null = null;
  const fromMeta = reservationIdFromInvoice(invoice);
  if (fromMeta) {
    const found = getDiscountReservation(fromMeta);
    if (found && found.accountId === accountId) reservation = found;
  }

  if (!reservation) {
    const candidates = listDiscountReservationsForAccount(accountId).filter(
      (r) => r.status === "applied" || r.status === "pending",
    );
    const subId = stripeSubscriptionId(invoice.parent?.subscription_details?.subscription);
    reservation =
      candidates.find(
        (r) =>
          (r.stripeInvoiceId && r.stripeInvoiceId === invoice.id) ||
          (subId && r.stripeSubscriptionId === subId && invoiceHasCoupon(invoice, r.stripeCouponId)),
      ) ?? null;
  }

  if (!reservation) {
    return { updated: false, reason: "no_matching_reservation" };
  }

  if (reservation.status === "consumed") {
    return { updated: false, reservationId: reservation.reservationId, reason: "already_consumed" };
  }

  // Require proof of discount on the paid invoice (or matching targeted invoice id).
  const provesDiscount =
    invoiceHasCoupon(invoice, reservation.stripeCouponId) ||
    reservation.stripeInvoiceId === invoice.id;

  if (!provesDiscount) {
    return {
      updated: false,
      reservationId: reservation.reservationId,
      reason: "discount_not_on_invoice",
    };
  }

  const paidAt =
    typeof invoice.status_transitions?.paid_at === "number"
      ? invoice.status_transitions.paid_at * 1000
      : Date.now();

  const consumed: DiscountReservation = {
    ...reservation,
    status: "consumed",
    stripeInvoiceId: invoice.id,
    stripeCustomerId: customerId,
    consumedAtUtc: paidAt,
  };
  if (typeof invoice.total === "number") consumed.expectedInvoiceTotalCents = invoice.total;
  if (typeof invoice.subtotal === "number") consumed.expectedSubtotalCents = invoice.subtotal;
  upsertDiscountReservation(consumed);

  return { updated: true, reservationId: reservation.reservationId };
}

/**
 * Failed payment / cancel: do not consume. Revert applied → reserved when the
 * discount never hit a paid invoice (so the user can retry within expiry).
 */
export async function reconcileRewardDiscountFromFailedInvoice(
  invoice: Stripe.Invoice,
): Promise<{ updated: boolean; reservationId?: string }> {
  const customerId = stripeCustomerId(invoice.customer);
  if (!customerId) return { updated: false };
  const accountId = await getUserBillingRepository().getUserIdByStripeCustomerId(customerId);
  if (!accountId) return { updated: false };

  const fromMeta = reservationIdFromInvoice(invoice);
  const reservation =
    (fromMeta ? getDiscountReservation(fromMeta) : null) ??
    listDiscountReservationsForAccount(accountId).find(
      (r) => r.status === "applied" && r.stripeInvoiceId === invoice.id,
    );

  if (!reservation || reservation.accountId !== accountId) return { updated: false };
  if (reservation.status === "consumed") return { updated: false };

  const next: DiscountReservation = {
    ...reservation,
    status: "reserved",
    lastError: "invoice_payment_failed",
  };
  delete next.stripeInvoiceId;
  delete next.appliedAtUtc;
  upsertDiscountReservation(next);
  return { updated: true, reservationId: reservation.reservationId };
}

/** Subscription canceled before consumption: expire/ineligible — do not silently keep applying. */
export function reconcileRewardDiscountOnSubscriptionDeleted(
  accountId: string,
  subscriptionId: string,
): void {
  for (const r of listDiscountReservationsForAccount(accountId)) {
    if (r.status !== "applied" && r.status !== "pending") continue;
    if (r.stripeSubscriptionId && r.stripeSubscriptionId !== subscriptionId) continue;
    upsertDiscountReservation({
      ...r,
      status: "ineligible",
      ineligibleReason: "subscription_canceled",
      lastError: "Subscription canceled before discount was consumed on a paid invoice.",
    });
  }
}
