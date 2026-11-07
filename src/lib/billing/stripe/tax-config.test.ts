import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildCheckoutSessionTaxParams,
  readStripeCheckoutTaxConfig,
} from "@/lib/billing/stripe/tax-config";

const TAX_ENV_KEYS = [
  "STRIPE_CHECKOUT_AUTOMATIC_TAX",
  "STRIPE_CHECKOUT_BILLING_ADDRESS_COLLECTION",
  "STRIPE_CHECKOUT_TAX_ID_COLLECTION",
  "STRIPE_CHECKOUT_CUSTOMER_UPDATE",
] as const;

function snapshotTaxEnv(): Record<string, string | undefined> {
  return Object.fromEntries(TAX_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreTaxEnv(previous: Record<string, string | undefined>): void {
  for (const key of TAX_ENV_KEYS) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("readStripeCheckoutTaxConfig", () => {
  const previousEnv = snapshotTaxEnv();

  beforeEach(() => {
    for (const key of TAX_ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    restoreTaxEnv(previousEnv);
  });

  it("enables exclusive automatic tax and disables managed payments by default", () => {
    expect(readStripeCheckoutTaxConfig()).toEqual({
      automaticTax: true,
      billingAddressCollection: null,
      taxIdCollection: false,
      customerUpdate: { address: "auto", name: "auto" },
    });
    expect(buildCheckoutSessionTaxParams()).toEqual({
      automatic_tax: { enabled: true },
      managed_payments: { enabled: false },
      customer_update: { address: "auto", name: "auto" },
    });
  });

  it("can turn automatic tax off explicitly", () => {
    process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = "false";
    expect(readStripeCheckoutTaxConfig().automaticTax).toBe(false);
    expect(buildCheckoutSessionTaxParams().automatic_tax).toEqual({ enabled: false });
    expect(buildCheckoutSessionTaxParams().managed_payments).toEqual({ enabled: false });
  });

  it("enables automatic tax when configured", () => {
    process.env.STRIPE_CHECKOUT_AUTOMATIC_TAX = "true";
    const config = readStripeCheckoutTaxConfig();
    expect(config.automaticTax).toBe(true);
    expect(buildCheckoutSessionTaxParams(config)).toEqual({
      automatic_tax: { enabled: true },
      managed_payments: { enabled: false },
      customer_update: { address: "auto", name: "auto" },
    });
  });

  it("supports billing address collection modes", () => {
    process.env.STRIPE_CHECKOUT_BILLING_ADDRESS_COLLECTION = "required";
    expect(readStripeCheckoutTaxConfig().billingAddressCollection).toBe("required");
    expect(buildCheckoutSessionTaxParams()).toEqual({
      automatic_tax: { enabled: true },
      managed_payments: { enabled: false },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
    });
  });

  it("supports tax id collection with customer update", () => {
    process.env.STRIPE_CHECKOUT_TAX_ID_COLLECTION = "true";
    expect(buildCheckoutSessionTaxParams()).toEqual({
      automatic_tax: { enabled: true },
      managed_payments: { enabled: false },
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
    });
  });

  it("allows disabling customer update while tax id collection stays on", () => {
    process.env.STRIPE_CHECKOUT_TAX_ID_COLLECTION = "true";
    process.env.STRIPE_CHECKOUT_CUSTOMER_UPDATE = "off";
    expect(buildCheckoutSessionTaxParams()).toEqual({
      automatic_tax: { enabled: true },
      managed_payments: { enabled: false },
      tax_id_collection: { enabled: true },
    });
  });
});
