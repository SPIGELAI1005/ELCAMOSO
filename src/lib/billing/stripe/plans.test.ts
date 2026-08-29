import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMMERCIAL_PLAN_IDS,
  getCommercialPlan,
  parseCommercialPlanId,
  stripePriceEnvKeyForPlan,
} from "@/lib/billing/stripe/plans";
import {
  isStripeConfigured,
  readStripeConfig,
  resolveStripePriceId,
} from "@/lib/billing/stripe/config";
import { getBillingPublicConfig } from "@/lib/billing/public-config";

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_DRIVE_PLUS_MONTHLY",
  "STRIPE_PRICE_DRIVE_PLUS_YEARLY",
  "ELCAMOSO_ENV",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("commercial plan mapping", () => {
  it("defines internal plan ids without Stripe price ids", () => {
    expect(COMMERCIAL_PLAN_IDS).toEqual(["drive_plus_monthly", "drive_plus_yearly"]);
    for (const id of COMMERCIAL_PLAN_IDS) {
      expect(id.startsWith("price_")).toBe(false);
    }
  });

  it("parses only known internal plan ids", () => {
    expect(parseCommercialPlanId("drive_plus_monthly")).toBe("drive_plus_monthly");
    expect(parseCommercialPlanId("drive_plus_yearly")).toBe("drive_plus_yearly");
    expect(parseCommercialPlanId("price_123")).toBeNull();
    expect(parseCommercialPlanId("pro")).toBeNull();
  });

  it("maps internal plans to server env keys", () => {
    expect(stripePriceEnvKeyForPlan("drive_plus_monthly")).toBe(
      "STRIPE_PRICE_DRIVE_PLUS_MONTHLY",
    );
    expect(stripePriceEnvKeyForPlan("drive_plus_yearly")).toBe("STRIPE_PRICE_DRIVE_PLUS_YEARLY");
  });

  it("resolves entitlement plan and interval from internal id", () => {
    expect(getCommercialPlan("drive_plus_monthly")).toMatchObject({
      plan: "DRIVE_PLUS",
      interval: "month",
    });
    expect(getCommercialPlan("drive_plus_yearly")).toMatchObject({
      plan: "DRIVE_PLUS",
      interval: "year",
    });
  });
});

describe("stripe config", () => {
  const previous = snapshotEnv();

  afterEach(() => {
    restoreEnv(previous);
  });

  it("requires all server secrets and mapped prices before enabling billing", () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY;
    delete process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY;
    expect(isStripeConfigured()).toBe(false);
    expect(getBillingPublicConfig().available).toBe(false);
  });

  it("resolves Stripe Price ids only from env via internal plan ids", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";

    const config = readStripeConfig();
    expect(config.configured).toBe(true);
    expect(resolveStripePriceId("drive_plus_monthly", config)).toBe("price_month_test");
    expect(resolveStripePriceId("drive_plus_yearly", config)).toBe("price_year_test");
  });

  it("never exposes secrets in public billing config", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_DRIVE_PLUS_MONTHLY = "price_month_test";
    process.env.STRIPE_PRICE_DRIVE_PLUS_YEARLY = "price_year_test";

    const publicConfig = getBillingPublicConfig();
    const serialized = JSON.stringify(publicConfig);
    expect(serialized).not.toContain("sk_test");
    expect(serialized).not.toContain("whsec");
    expect(serialized).not.toContain("price_month_test");
    expect(publicConfig.plans.map((plan) => plan.id)).toEqual(COMMERCIAL_PLAN_IDS);
  });
});

describe("beginDrivePlusCheckout guard", () => {
  const previous = snapshotEnv();

  afterEach(() => {
    restoreEnv(previous);
    vi.restoreAllMocks();
  });

  it("rejects checkout when Stripe is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { beginDrivePlusCheckout } = await import("@/lib/billing/checkout-service");
    await expect(
      beginDrivePlusCheckout({
        userId: "user-1",
        email: "driver@example.com",
        origin: "http://localhost:5173",
        request: { plan: "drive_plus", interval: "monthly" },
      }),
    ).rejects.toThrow("Billing is not available");
  });
});
