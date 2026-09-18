import { resolveDeployEnv, type ElcamosoDeployEnv } from "@/lib/tesla/config";
import { stripePriceEnvKeyForPlan, type CommercialPlanId } from "@/lib/billing/stripe/plans";

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

export interface StripePriceConfig {
  drive_plus_monthly: string;
  drive_plus_yearly: string;
}

export interface StripeConfig {
  deploy: ElcamosoDeployEnv;
  configured: boolean;
  secretKey: string;
  webhookSecret: string;
  prices: StripePriceConfig;
}

export function readStripeConfig(deploy = resolveDeployEnv()): StripeConfig {
  const secretKey = readScopedEnv("STRIPE_SECRET_KEY", deploy) ?? "";
  const webhookSecret = readScopedEnv("STRIPE_WEBHOOK_SECRET", deploy) ?? "";
  const prices: StripePriceConfig = {
    drive_plus_monthly: readScopedEnv(stripePriceEnvKeyForPlan("drive_plus_monthly"), deploy) ?? "",
    drive_plus_yearly: readScopedEnv(stripePriceEnvKeyForPlan("drive_plus_yearly"), deploy) ?? "",
  };

  const configured = Boolean(
    secretKey && webhookSecret && prices.drive_plus_monthly && prices.drive_plus_yearly,
  );

  return {
    deploy,
    configured,
    secretKey,
    webhookSecret,
    prices,
  };
}

/** Resolve a Stripe Price id from an internal commercial plan id - server-only. */
export function resolveStripePriceId(
  commercialPlanId: CommercialPlanId,
  config: StripeConfig = readStripeConfig(),
): string {
  const priceId = config.prices[commercialPlanId];
  if (!priceId) {
    throw new Error(`Stripe price not configured for ${commercialPlanId}`);
  }
  return priceId;
}

/** Whether checkout and webhooks can run in the current environment. */
export function isStripeConfigured(config: StripeConfig = readStripeConfig()): boolean {
  return config.configured;
}
