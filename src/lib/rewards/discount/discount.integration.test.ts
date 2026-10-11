import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import {
  getSubscriptionRepository,
  resetSubscriptionRepositoryStoreForTests,
} from "@/lib/billing/subscription-repository-memory";
import {
  resetSubscriptionStoreForTests,
  setSubscriptionForUser,
} from "@/lib/billing/subscription-store";
import { resetStripeClientForTests } from "@/lib/billing/stripe/client";
import {
  memoryUserBillingRepository,
  resetUserBillingRepositoryForTests,
} from "@/lib/billing/user-billing-store";
import { resetWebhookEventStoreStateForTests } from "@/lib/billing/webhook-event-store-memory";

import {
  getDiscountReservation,
  resetRewardStoreForTests,
  upsertDiscountReservation,
} from "../store";
import type { DiscountReservation } from "../types";
import { computeExpectedInvoiceTotals } from "./policy";
import {
  reconcileRewardDiscountFromFailedInvoice,
  reconcileRewardDiscountFromPaidInvoice,
} from "./reconcile";
import {
  applyRenewalRewardDiscount,
  prepareCheckoutRewardDiscount,
  previewRewardDiscount,
  retryApplyRenewalRewardDiscount,
} from "./service";
import {
  setRewardDiscountStripeOpsForTests,
  type RewardDiscountStripeOps,
} from "./stripe-ops";

const ACCOUNT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = Date.parse("2026-10-15T12:00:00.000Z");
const COUPON = "coupon_reward_15_test";
const SUB_ID = "sub_monthly_test";
const CUS_ID = "cus_reward_test";
const RES_ID = "11111111-1111-4111-8111-111111111111";

const ENV_KEYS = [
  "ELCAMOSO_REWARD_DISCOUNTS_ENABLED",
  "STRIPE_REWARD_COUPON_PERCENT_15",
  "STRIPE_REWARD_COUPON_PERCENT_20",
  "ELCAMOSO_REWARD_DISCOUNT_FINALIZED_ALTERNATIVE",
  "MONETIZATION_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_DRIVE_PLUS_MONTHLY",
  "STRIPE_PRICE_DRIVE_PLUS_YEARLY",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}

function restoreEnv(prev: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    const v = prev[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function seedReservation(overrides: Partial<DiscountReservation> = {}): DiscountReservation {
  return upsertDiscountReservation({
    reservationId: RES_ID,
    accountId: ACCOUNT,
    claimId: "22222222-2222-4222-8222-222222222222",
    discountPercent: 15,
    status: "reserved",
    createdAtUtc: NOW,
    expiresAtUtc: NOW + 30 * 24 * 3600 * 1000,
    ...overrides,
  });
}

async function seedMonthlySubscription(userId = ACCOUNT) {
  setSubscriptionForUser({
    userId,
    plan: "DRIVE_PLUS",
    status: "active",
    interval: "month",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date("2026-11-15T00:00:00.000Z"),
  });
  await getSubscriptionRepository().upsert({
    userId,
    provider: "stripe",
    providerCustomerId: CUS_ID,
    providerSubscriptionId: SUB_ID,
    plan: "DRIVE_PLUS",
    interval: "month",
    status: "active",
    currentPeriodStart: new Date("2026-10-15T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-11-15T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
  });
}

const checkoutCreate = vi.fn();
const customersCreate = vi.fn();
const customersRetrieve = vi.fn();
const subscriptionsList = vi.fn();

vi.mock("@/lib/billing/stripe/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/stripe/client")>(
    "@/lib/billing/stripe/client",
  );
  return {
    ...actual,
    getStripeClient: () => ({
      customers: { create: customersCreate, retrieve: customersRetrieve },
      checkout: { sessions: { create: checkoutCreate } },
      subscriptions: { list: subscriptionsList },
      billingPortal: { sessions: { create: vi.fn() } },
    }),
    resetStripeClientForTests: actual.resetStripeClientForTests,
  };
});

describe("Prompt 13 reward discount fulfilment (test-mode scenarios)", () => {
  const prevEnv = snapshotEnv();
  let updateCalls: number;
  let lastIdempotencyKey: string | undefined;
  let previewImpl: RewardDiscountStripeOps["createInvoicePreview"];

  beforeEach(async () => {
    restoreEnv(prevEnv);
    resetRewardStoreForTests();
    resetSubscriptionStoreForTests();
    resetSubscriptionRepositoryStoreForTests();
    resetUserBillingRepositoryForTests();
    resetWebhookEventStoreStateForTests();
    resetStripeClientForTests();
    updateCalls = 0;
    lastIdempotencyKey = undefined;

    process.env.ELCAMOSO_REWARD_DISCOUNTS_ENABLED = "1";
    process.env.STRIPE_REWARD_COUPON_PERCENT_15 = COUPON;
    process.env.STRIPE_REWARD_COUPON_PERCENT_20 = "coupon_reward_20_test";
    process.env.ELCAMOSO_REWARD_DISCOUNT_FINALIZED_ALTERNATIVE = "pending";
    process.env.MONETIZATION_ENABLED = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";

    await memoryUserBillingRepository.setStripeCustomerId(ACCOUNT, CUS_ID);
    customersRetrieve.mockResolvedValue({ id: CUS_ID, deleted: false });
    customersCreate.mockResolvedValue({ id: CUS_ID });
    subscriptionsList.mockResolvedValue({ data: [] });
    checkoutCreate.mockResolvedValue({
      id: "cs_reward_1",
      url: "https://checkout.stripe.test/cs_reward_1",
    });

    previewImpl = async () => ({
      id: "in_upcoming_draft",
      status: "draft",
      currency: "eur",
      subtotal: 1000,
      total: 1000,
      discountCount: 0,
    });

    setRewardDiscountStripeOpsForTests({
      retrieveSubscription: async () =>
        ({ id: SUB_ID, discounts: [] }) as unknown as Stripe.Subscription,
      updateSubscriptionDiscounts: async ({ couponId, idempotencyKey }) => {
        updateCalls += 1;
        lastIdempotencyKey = idempotencyKey;
        return {
          id: SUB_ID,
          discounts: [{ id: "di_test", coupon: couponId }],
        } as unknown as Stripe.Subscription;
      },
      createInvoicePreview: (input) => previewImpl(input),
      retrieveInvoice: async (id) => ({ id }) as Stripe.Invoice,
    });
  });

  afterEach(() => {
    setRewardDiscountStripeOpsForTests(null);
    restoreEnv(prevEnv);
    vi.clearAllMocks();
  });

  it("keeps feature off until configured", () => {
    delete process.env.ELCAMOSO_REWARD_DISCOUNTS_ENABLED;
    seedReservation();
    const prepared = prepareCheckoutRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      interval: "monthly",
      nowMs: NOW,
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.error).toBe("feature_disabled");
  });

  it("first purchase: monthly Checkout gets coupon; expected totals 1000 → 850", async () => {
    seedReservation();
    const result = await beginDrivePlusCheckout({
      userId: ACCOUNT,
      email: "driver@example.com",
      origin: "http://localhost:5173",
      request: { plan: "drive_plus", interval: "monthly" },
      rewardReservationId: RES_ID,
    });
    expect(result.action).toBe("checkout");
    const params = checkoutCreate.mock.calls[0]![0] as Stripe.Checkout.SessionCreateParams;
    expect(params.discounts).toEqual([{ coupon: COUPON }]);
    expect(computeExpectedInvoiceTotals(1000, 15)).toEqual({
      discountAmountCents: 150,
      totalCents: 850,
    });
    expect(getDiscountReservation(RES_ID)?.status).toBe("applied");
    expect(getDiscountReservation(RES_ID)?.stripeCheckoutSessionId).toBe("cs_reward_1");
  });

  it("existing monthly subscriber: applies once coupon to next draft invoice", async () => {
    seedReservation();
    await seedMonthlySubscription();
    const applied = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.expected).toEqual({
      subtotalCents: 1000,
      discountAmountCents: 150,
      totalCents: 850,
      currency: "eur",
      targetInvoiceId: "in_upcoming_draft",
    });
    expect(applied.reservation.status).toBe("applied");
    expect(updateCalls).toBe(1);
  });

  it("duplicate redemption returns the same applied reservation", async () => {
    seedReservation();
    await seedMonthlySubscription();
    const first = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    const second = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW + 1,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.reservation.reservationId).toBe(first.reservation.reservationId);
    expect(updateCalls).toBe(1);
  });

  it("rejects another customer's reservation", async () => {
    seedReservation({ accountId: OTHER });
    await memoryUserBillingRepository.setStripeCustomerId(OTHER, "cus_other");
    const result = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("wrong_account");
  });

  it("rejects posted customer id that does not match verified ownership", async () => {
    seedReservation();
    await seedMonthlySubscription();
    const result = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      postedCustomerId: "cus_attacker",
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("customer_mismatch");
  });

  it("expired reward cannot be applied", async () => {
    seedReservation({ expiresAtUtc: NOW - 1 });
    await seedMonthlySubscription();
    const result = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("expired");
  });

  it("conflicting existing discount is non-stacking / existing wins", async () => {
    seedReservation();
    await seedMonthlySubscription();
    previewImpl = async () => ({
      id: "in_conflict",
      status: "draft",
      currency: "eur",
      subtotal: 1000,
      total: 800,
      discountCount: 1,
    });
    const result = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("existing_discount");
    expect(getDiscountReservation(RES_ID)?.status).toBe("ineligible");
  });

  it("invoice boundary: finalized open invoice → pending (configured alternative)", async () => {
    seedReservation();
    await seedMonthlySubscription();
    previewImpl = async () => ({
      id: "in_open",
      status: "open",
      currency: "eur",
      subtotal: 1000,
      total: 1000,
      discountCount: 0,
    });
    const result = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invoice_finalized");
    expect(getDiscountReservation(RES_ID)?.status).toBe("pending");
  });

  it("timeout retry uses stable idempotency key and does not double-apply after success", async () => {
    seedReservation();
    await seedMonthlySubscription();
    let failOnce = true;
    setRewardDiscountStripeOpsForTests({
      retrieveSubscription: async () =>
        ({ id: SUB_ID, discounts: [] }) as unknown as Stripe.Subscription,
      updateSubscriptionDiscounts: async ({ couponId, idempotencyKey }) => {
        lastIdempotencyKey = idempotencyKey;
        if (failOnce) {
          failOnce = false;
          throw new Error("ETIMEDOUT");
        }
        updateCalls += 1;
        return {
          id: SUB_ID,
          discounts: [{ id: "di_retry", coupon: couponId }],
        } as unknown as Stripe.Subscription;
      },
      createInvoicePreview: (input) => previewImpl(input),
      retrieveInvoice: async (id) => ({ id }) as Stripe.Invoice,
    });

    const failed = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(failed.ok).toBe(false);
    const key = lastIdempotencyKey;
    expect(key).toBe(`reward-discount:${RES_ID}:renewal-apply`);

    const retried = await retryApplyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW + 10,
    });
    expect(retried.ok).toBe(true);
    expect(lastIdempotencyKey).toBe(key);
    expect(updateCalls).toBe(1);
  });

  it("webhook paid invoice consumes; replay is idempotent; return URL alone does not", async () => {
    seedReservation({
      status: "applied",
      stripeCouponId: COUPON,
      stripeCustomerId: CUS_ID,
      stripeSubscriptionId: SUB_ID,
      stripeInvoiceId: "in_paid_1",
      discountCase: "renewal_next_monthly",
    });

    const invoice = {
      id: "in_paid_1",
      object: "invoice",
      status: "paid",
      customer: CUS_ID,
      total: 850,
      subtotal: 1000,
      discounts: [{ id: "di_1", coupon: COUPON }],
      parent: {
        subscription_details: {
          subscription: SUB_ID,
          metadata: { rewardReservationId: RES_ID },
        },
      },
      status_transitions: { paid_at: Math.floor(NOW / 1000) },
      metadata: { rewardReservationId: RES_ID },
    } as unknown as Stripe.Invoice;

    const first = await reconcileRewardDiscountFromPaidInvoice(invoice);
    expect(first.updated).toBe(true);
    expect(getDiscountReservation(RES_ID)?.status).toBe("consumed");

    const replay = await reconcileRewardDiscountFromPaidInvoice(invoice);
    expect(replay.updated).toBe(false);
    expect(replay.reason).toBe("already_consumed");
  });

  it("failed payment releases applied → reserved (not consumed)", async () => {
    seedReservation({
      status: "applied",
      stripeCouponId: COUPON,
      stripeCustomerId: CUS_ID,
      stripeInvoiceId: "in_fail_1",
    });
    await reconcileRewardDiscountFromFailedInvoice({
      id: "in_fail_1",
      status: "open",
      customer: CUS_ID,
      metadata: { rewardReservationId: RES_ID },
    } as unknown as Stripe.Invoice);
    expect(getDiscountReservation(RES_ID)?.status).toBe("reserved");
  });

  it("annual subscriber is ineligible for monthly reward discount", async () => {
    seedReservation();
    setSubscriptionForUser({
      userId: ACCOUNT,
      plan: "DRIVE_PLUS",
      status: "active",
      interval: "year",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2027-10-15T00:00:00.000Z"),
    });
    await getSubscriptionRepository().upsert({
      userId: ACCOUNT,
      provider: "stripe",
      providerCustomerId: CUS_ID,
      providerSubscriptionId: "sub_year",
      plan: "DRIVE_PLUS",
      interval: "year",
      status: "active",
      currentPeriodStart: new Date("2026-10-15T00:00:00.000Z"),
      currentPeriodEnd: new Date("2027-10-15T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    });
    const result = await applyRenewalRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("annual_interval");
  });

  it("preview exposes terms before redemption", () => {
    seedReservation();
    const preview = previewRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      nowMs: NOW,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.terms.eligiblePlan).toBe("Drive+ monthly");
    expect(preview.terms.checkoutReturnDoesNotConsume).toBe(true);
    expect(preview.terms.annualSubscribers).toBe("ineligible");
    expect(preview.checkout.ok).toBe(true);
  });

  it("does not invent yearly Checkout discounts", () => {
    seedReservation();
    const prepared = prepareCheckoutRewardDiscount({
      accountId: ACCOUNT,
      reservationId: RES_ID,
      interval: "yearly",
      nowMs: NOW,
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.error).toBe("annual_interval");
  });
});
