import type Stripe from "stripe";

import { resolveDeployEnv, type ElcamosoDeployEnv } from "@/lib/tesla/config";

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function envSuffix(deploy: ElcamosoDeployEnv): string {
  if (deploy === "production") return "_PRODUCTION";
  if (deploy === "staging") return "_STAGING";
  return "";
}

function readScopedEnv(baseName: string, deploy: ElcamosoDeployEnv): string | undefined {
  const suffix = envSuffix(deploy);
  return readEnv(`${baseName}${suffix}`) ?? readEnv(baseName);
}

function readBooleanEnv(name: string, deploy: ElcamosoDeployEnv): boolean {
  const raw = readScopedEnv(name, deploy)?.toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type StripeBillingAddressCollection = "auto" | "required";

/**
 * Checkout tax-related flags — all off by default.
 * Does not encode VAT rates, registrations, or legal jurisdiction logic.
 */
export interface StripeCheckoutTaxConfig {
  automaticTax: boolean;
  billingAddressCollection: StripeBillingAddressCollection | null;
  taxIdCollection: boolean;
  /** Persist Checkout-collected name/address on the Customer when tax features are on. */
  customerUpdate: Stripe.Checkout.SessionCreateParams.CustomerUpdate | null;
}

function readBillingAddressCollection(
  deploy: ElcamosoDeployEnv,
): StripeBillingAddressCollection | null {
  const raw = readScopedEnv("STRIPE_CHECKOUT_BILLING_ADDRESS_COLLECTION", deploy)?.toLowerCase();
  if (raw === "auto" || raw === "required") return raw;
  return null;
}

function readCustomerUpdate(
  deploy: ElcamosoDeployEnv,
  taxFeaturesEnabled: boolean,
): Stripe.Checkout.SessionCreateParams.CustomerUpdate | null {
  const raw = readScopedEnv("STRIPE_CHECKOUT_CUSTOMER_UPDATE", deploy)?.toLowerCase();
  if (raw === "off" || raw === "false" || raw === "0") return null;
  if (raw === "auto" || raw === "true" || raw === "1") {
    return { address: "auto", name: "auto" };
  }
  if (taxFeaturesEnabled) {
    return { address: "auto", name: "auto" };
  }
  return null;
}

export function readStripeCheckoutTaxConfig(
  deploy = resolveDeployEnv(),
): StripeCheckoutTaxConfig {
  const automaticTax = readBooleanEnv("STRIPE_CHECKOUT_AUTOMATIC_TAX", deploy);
  const taxIdCollection = readBooleanEnv("STRIPE_CHECKOUT_TAX_ID_COLLECTION", deploy);
  const taxFeaturesEnabled = automaticTax || taxIdCollection;

  return {
    automaticTax,
    billingAddressCollection: readBillingAddressCollection(deploy),
    taxIdCollection,
    customerUpdate: readCustomerUpdate(deploy, taxFeaturesEnabled),
  };
}

/** Maps tax config to Stripe Checkout Session params. Omits keys when features are disabled. */
export function buildCheckoutSessionTaxParams(
  config: StripeCheckoutTaxConfig = readStripeCheckoutTaxConfig(),
): Pick<
  Stripe.Checkout.SessionCreateParams,
  "automatic_tax" | "billing_address_collection" | "tax_id_collection" | "customer_update"
> {
  const params: Pick<
    Stripe.Checkout.SessionCreateParams,
    "automatic_tax" | "billing_address_collection" | "tax_id_collection" | "customer_update"
  > = {};

  if (config.automaticTax) {
    params.automatic_tax = { enabled: true };
  }
  if (config.billingAddressCollection) {
    params.billing_address_collection = config.billingAddressCollection;
  }
  if (config.taxIdCollection) {
    params.tax_id_collection = { enabled: true };
  }
  if (config.customerUpdate) {
    params.customer_update = config.customerUpdate;
  }

  return params;
}

export function isStripeCheckoutTaxConfigured(
  config: StripeCheckoutTaxConfig = readStripeCheckoutTaxConfig(),
): boolean {
  return (
    config.automaticTax ||
    config.billingAddressCollection != null ||
    config.taxIdCollection ||
    config.customerUpdate != null
  );
}
