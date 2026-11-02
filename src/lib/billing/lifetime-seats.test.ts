import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { beginDrivePlusCheckout } from "@/lib/billing/checkout-service";
import { lifetimeSeatStatus, LIFETIME_SEAT_LIMIT } from "@/lib/billing/lifetime-seats";
import { getLifetimeSeatStatus } from "@/lib/billing/lifetime-seats.server";
import {
  recordLifetimeGrant,
  resetLifetimeStoreForTests,
  revokeLifetimeGrant,
} from "@/lib/billing/lifetime-store";
import { resetSubscriptionStoreForTests } from "@/lib/billing/subscription-store";
import { resetUserBillingRepositoryForTests } from "@/lib/billing/user-billing-store";
import { LifetimeSeatsCounter } from "@/components/LandingPlansSection";

const checkoutCreate = vi.fn();
vi.mock("@/lib/billing/stripe/client", () => ({
  getStripeClient: () => ({
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }), retrieve: vi.fn() },
    checkout: { sessions: { create: checkoutCreate } },
    subscriptions: { list: vi.fn().mockResolvedValue({ data: [] }) },
    billingPortal: { sessions: { create: vi.fn() } },
  }),
  resetStripeClientForTests: vi.fn(),
}));

const KEYS = [
  "MONETIZATION_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_DRIVE_PLUS_YEARLY",
  "STRIPE_PRICE_DRIVE_PLUS_LIFETIME",
  "STRIPE_PRICE_DRIVE_PLUS_MONTHLY",
  "DATABASE_URL",
] as const;
const prev = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function sell(n: number) {
  for (let i = 0; i < n; i += 1) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    recordLifetimeGrant({
      userId: id,
      paymentIntentId: `pi_${i}`,
      checkoutSessionId: null,
      stripeCustomerId: null,
    });
  }
}

const buyer = "22222222-2222-4222-8222-222222222222";
const lifetimeCheckout = () =>
  beginDrivePlusCheckout({
    userId: buyer,
    email: "driver@example.com",
    origin: "http://localhost:5173",
    request: { plan: "drive_plus", interval: "lifetime" },
  });

describe("Lifetime seats (limit 50)", () => {
  beforeEach(() => {
    resetLifetimeStoreForTests();
    resetSubscriptionStoreForTests();
    resetUserBillingRepositoryForTests();
    delete process.env.DATABASE_URL;
    process.env.MONETIZATION_ENABLED = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_LIFETIME = "price_life_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    checkoutCreate.mockResolvedValue({
      id: "cs_life",
      url: "https://checkout.stripe.test/cs_life",
    });
  });
  afterEach(() => {
    for (const k of KEYS)
      prev[k] === undefined ? delete process.env[k] : (process.env[k] = prev[k]);
    vi.clearAllMocks();
  });

  it("computes seats left from the sold count", () => {
    expect(LIFETIME_SEAT_LIMIT).toBe(50);
    expect(lifetimeSeatStatus(0)).toEqual({ limit: 50, sold: 0, left: 50, soldOut: false });
    expect(lifetimeSeatStatus(49).left).toBe(1);
    expect(lifetimeSeatStatus(50)).toMatchObject({ left: 0, soldOut: true });
    expect(lifetimeSeatStatus(73)).toMatchObject({ left: 0, soldOut: true });
    expect(lifetimeSeatStatus(Number.NaN).left).toBe(50);
  });

  it("counts real completed, non-refunded Lifetime purchases", async () => {
    sell(3);
    expect((await getLifetimeSeatStatus()).left).toBe(47);
    revokeLifetimeGrant("pi_1");
    expect((await getLifetimeSeatStatus()).left).toBe(48);
  });

  it("allows Lifetime checkout while seats remain", async () => {
    sell(49);
    const result = await lifetimeCheckout();
    expect(result.action).toBe("checkout");
    expect(checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment" }));
  });

  it("blocks Lifetime checkout server-side at 0 seats left", async () => {
    sell(50);
    await expect(lifetimeCheckout()).rejects.toThrow(/sold out/i);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("renders the counter and the sold-out state (EN/DE/RO)", () => {
    const en = renderToStaticMarkup(
      createElement(LifetimeSeatsCounter, { seats: lifetimeSeatStatus(8), language: "en" }),
    );
    expect(en).toContain("Launch price: 42 of 50 seats left");
    expect(
      renderToStaticMarkup(
        createElement(LifetimeSeatsCounter, { seats: lifetimeSeatStatus(8), language: "de" }),
      ),
    ).toContain("Einführungspreis: noch 42 von 50 Plätzen frei");
    expect(
      renderToStaticMarkup(
        createElement(LifetimeSeatsCounter, { seats: lifetimeSeatStatus(8), language: "ro" }),
      ),
    ).toContain("Preț de lansare: 42 din 50 locuri disponibile");
    const out = renderToStaticMarkup(
      createElement(LifetimeSeatsCounter, { seats: lifetimeSeatStatus(50), language: "en" }),
    );
    expect(out).toContain("Sold out");
    expect(out).toContain('data-sold-out="true"');
    expect(
      renderToStaticMarkup(createElement(LifetimeSeatsCounter, { seats: null, language: "en" })),
    ).toBe("");
  });
});
