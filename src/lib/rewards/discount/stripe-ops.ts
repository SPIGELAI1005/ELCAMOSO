import type Stripe from "stripe";

import { getStripeClient } from "@/lib/billing/stripe/client";

/**
 * Narrow Stripe surface for reward discounts — mockable in tests.
 * Never trusts client-posted customer IDs; callers pass server-resolved ids.
 */
export interface RewardDiscountStripeOps {
  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  updateSubscriptionDiscounts(input: {
    subscriptionId: string;
    couponId: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.Subscription>;
  createInvoicePreview(input: {
    customerId: string;
    subscriptionId: string;
  }): Promise<{
    id: string | null;
    status: string | null;
    currency: string | null;
    subtotal: number | null;
    total: number | null;
    discountCount: number;
  }>;
  retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice>;
}

function discountCountFrom(obj: { discounts?: unknown }): number {
  const d = obj.discounts;
  if (Array.isArray(d)) return d.length;
  return 0;
}

export function createLiveRewardDiscountStripeOps(): RewardDiscountStripeOps {
  return {
    async retrieveSubscription(subscriptionId) {
      return getStripeClient().subscriptions.retrieve(subscriptionId);
    },
    async updateSubscriptionDiscounts(input) {
      return getStripeClient().subscriptions.update(
        input.subscriptionId,
        {
          discounts: [{ coupon: input.couponId }],
          metadata: input.metadata,
        },
        { idempotencyKey: input.idempotencyKey },
      );
    },
    async createInvoicePreview(input) {
      const stripe = getStripeClient();
      // Stripe SDK 22 / API 2026: createPreview replaces retrieveUpcoming.
      const preview = await stripe.invoices.createPreview({
        customer: input.customerId,
        subscription: input.subscriptionId,
      });
      return {
        id: typeof preview.id === "string" ? preview.id : null,
        status: typeof preview.status === "string" ? preview.status : null,
        currency: typeof preview.currency === "string" ? preview.currency : null,
        subtotal: typeof preview.subtotal === "number" ? preview.subtotal : null,
        total: typeof preview.total === "number" ? preview.total : null,
        discountCount: discountCountFrom(preview),
      };
    },
    async retrieveInvoice(invoiceId) {
      return getStripeClient().invoices.retrieve(invoiceId);
    },
  };
}

let injectedOps: RewardDiscountStripeOps | null = null;

export function setRewardDiscountStripeOpsForTests(ops: RewardDiscountStripeOps | null): void {
  injectedOps = ops;
}

export function getRewardDiscountStripeOps(): RewardDiscountStripeOps {
  return injectedOps ?? createLiveRewardDiscountStripeOps();
}
