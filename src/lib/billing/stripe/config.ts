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
  // On Vercel production, live keys win even if ELCAMOSO_ENV still says development.
  if (readEnv("VERCEL_ENV") === "production") {
    const live = readEnv(`${baseName}_PRODUCTION`);
    if (live) return live;
  }
  const suffix = envSuffix(deploy);
  return readEnv(`${baseName}${suffix}`) ?? readEnv(baseName);
}

export interface StripePriceConfig {
  drive_plus_monthly: string;
  drive_plus_yearly: string;
  /** Drive the Music monthly price. */
  drive_music_monthly: string;
  /** Drive the Music yearly price. Music checkout needs both monthly and yearly. */
  drive_music_yearly: string;
  /** Drive Unlimited monthly price. */
  drive_unlimited_monthly: string;
  /** Drive Unlimited yearly price. Unlimited checkout needs both monthly and yearly. */
  drive_unlimited_yearly: string;
  /** Optional one-time price; lifetime checkout is unavailable when empty. */
  drive_plus_lifetime: string;
  /**
   * Founders Pack one-time Price id. PLACEHOLDER: unset until the owner creates the
   * Stripe product. Do not invent a euro amount in code.
   */
  founders_pack: string;
}

export interface StripeConfig {
  deploy: ElcamosoDeployEnv;
  configured: boolean;
  secretKey: string;
  webhookSecret: string;
  prices: StripePriceConfig;
}

const PRICE_ENV_ALIASES: Partial<Record<CommercialPlanId, readonly string[]>> = {
  drive_music_monthly: ["STRIPE_PRICE_DRIVE_THE_MUSIC_MONTHLY"],
  drive_music_yearly: ["STRIPE_PRICE_DRIVE_THE_MUSIC_YEARLY"],
  drive_plus_lifetime: ["STRIPE_PRICE_LIFETIME", "STRIPE_PRICE_DRIVE_LIFETIME"],
};

function readPriceEnv(planId: CommercialPlanId, deploy: ElcamosoDeployEnv): string {
  const primary = readScopedEnv(stripePriceEnvKeyForPlan(planId), deploy);
  if (primary) return primary;
  for (const alias of PRICE_ENV_ALIASES[planId] ?? []) {
    const value = readScopedEnv(alias, deploy);
    if (value) return value;
  }
  return "";
}

export function readStripeConfig(deploy = resolveDeployEnv()): StripeConfig {
  const secretKey = readScopedEnv("STRIPE_SECRET_KEY", deploy) ?? "";
  const webhookSecret = readScopedEnv("STRIPE_WEBHOOK_SECRET", deploy) ?? "";
  const prices: StripePriceConfig = {
    drive_plus_monthly: readPriceEnv("drive_plus_monthly", deploy),
    drive_plus_yearly: readPriceEnv("drive_plus_yearly", deploy),
    drive_music_monthly: readPriceEnv("drive_music_monthly", deploy),
    drive_music_yearly: readPriceEnv("drive_music_yearly", deploy),
    drive_unlimited_monthly: readPriceEnv("drive_unlimited_monthly", deploy),
    drive_unlimited_yearly: readPriceEnv("drive_unlimited_yearly", deploy),
    drive_plus_lifetime: readPriceEnv("drive_plus_lifetime", deploy),
    founders_pack: readPriceEnv("founders_pack", deploy),
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

/** Whether the one-time Drive+ Lifetime price is configured. */
export function isLifetimePriceConfigured(config: StripeConfig = readStripeConfig()): boolean {
  return Boolean(config.prices.drive_plus_lifetime);
}

/** Whether Drive the Music monthly and yearly prices are configured. */
export function isMusicPriceConfigured(config: StripeConfig = readStripeConfig()): boolean {
  return Boolean(config.prices.drive_music_monthly && config.prices.drive_music_yearly);
}

/** Whether Drive Unlimited monthly and yearly prices are configured. */
export function isUnlimitedPriceConfigured(config: StripeConfig = readStripeConfig()): boolean {
  return Boolean(config.prices.drive_unlimited_monthly && config.prices.drive_unlimited_yearly);
}

/** Whether the Founders Pack one-time Price id is set (no amount is stored in code). */
export function isFoundersPackPriceConfigured(config: StripeConfig = readStripeConfig()): boolean {
  return Boolean(config.prices.founders_pack);
}

/** Whether checkout and webhooks can run in the current environment. */
export function isStripeConfigured(config: StripeConfig = readStripeConfig()): boolean {
  return config.configured;
}

/** Which server settings Checkout needs. Booleans only: never the secret values. */
export function stripeCheckoutRequirements(
  config: StripeConfig = readStripeConfig(),
): {
  secretKey: boolean;
  webhookSecret: boolean;
  drivePlusMonthly: boolean;
  drivePlusYearly: boolean;
} {
  return {
    secretKey: Boolean(config.secretKey),
    webhookSecret: Boolean(config.webhookSecret),
    drivePlusMonthly: Boolean(config.prices.drive_plus_monthly),
    drivePlusYearly: Boolean(config.prices.drive_plus_yearly),
  };
}
