import type { Plan } from "@/lib/entitlements/types";
import type { BillingInterval } from "@/lib/billing/status";

/** Internal commercial plan ids - safe for client requests. Never Stripe Price ids. */
export type CommercialPlanId =
  | "drive_plus_monthly"
  | "drive_plus_yearly"
  | "drive_music_monthly"
  | "drive_music_yearly"
  | "drive_unlimited_monthly"
  | "drive_unlimited_yearly"
  | "drive_plus_lifetime"
  /** One-time Founders Pack. Price id from STRIPE_PRICE_FOUNDERS_PACK only — no invented amount. */
  | "founders_pack";

/** Stripe Checkout mode for a commercial plan. */
export type CommercialPlanMode = "subscription" | "payment";

export const COMMERCIAL_PLAN_IDS: readonly CommercialPlanId[] = [
  "drive_plus_monthly",
  "drive_plus_yearly",
  "drive_music_monthly",
  "drive_music_yearly",
  "drive_unlimited_monthly",
  "drive_unlimited_yearly",
  "drive_plus_lifetime",
  "founders_pack",
] as const;

export interface CommercialPlan {
  id: CommercialPlanId;
  /** ELCAMOSO entitlement plan granted after verified billing. */
  plan: Plan;
  /** Null for one-time purchases (lifetime). */
  interval: BillingInterval | null;
  mode: CommercialPlanMode;
  label: string;
}

export const COMMERCIAL_PLANS: readonly CommercialPlan[] = [
  {
    id: "drive_plus_monthly",
    plan: "DRIVE_PLUS",
    interval: "month",
    mode: "subscription",
    label: "Drive+ Monthly",
  },
  {
    id: "drive_plus_yearly",
    plan: "DRIVE_PLUS",
    interval: "year",
    mode: "subscription",
    label: "Drive+ Yearly",
  },
  {
    id: "drive_music_monthly",
    plan: "DRIVE_MUSIC",
    interval: "month",
    mode: "subscription",
    label: "Drive the Music Monthly",
  },
  {
    id: "drive_music_yearly",
    plan: "DRIVE_MUSIC",
    interval: "year",
    mode: "subscription",
    label: "Drive the Music Yearly",
  },
  {
    id: "drive_unlimited_monthly",
    plan: "DRIVE_COMPLETE",
    interval: "month",
    mode: "subscription",
    label: "Drive Unlimited Monthly",
  },
  {
    // Drive Unlimited: Drive+ AND Drive the Music as one subscription.
    id: "drive_unlimited_yearly",
    plan: "DRIVE_COMPLETE",
    interval: "year",
    mode: "subscription",
    label: "Drive Unlimited Yearly",
  },
  {
    // Id kept for env/back-compat; Lifetime now includes Drive+ AND Drive the Music.
    id: "drive_plus_lifetime",
    plan: "DRIVE_COMPLETE",
    interval: null,
    mode: "payment",
    label: "Lifetime (Drive+ & Drive the Music)",
  },
  {
    id: "founders_pack",
    plan: "DRIVE_COMPLETE",
    interval: null,
    mode: "payment",
    label: "Founders Pack",
  },
] as const;

const COMMERCIAL_PLAN_MAP = new Map<CommercialPlanId, CommercialPlan>(
  COMMERCIAL_PLANS.map((plan) => [plan.id, plan]),
);

export function parseCommercialPlanId(value: string): CommercialPlanId | null {
  return COMMERCIAL_PLAN_IDS.includes(value as CommercialPlanId)
    ? (value as CommercialPlanId)
    : null;
}

export function getCommercialPlan(id: CommercialPlanId): CommercialPlan {
  const plan = COMMERCIAL_PLAN_MAP.get(id);
  if (!plan) throw new Error(`Unknown commercial plan: ${id}`);
  return plan;
}

/** Env var holding the Stripe Price id for this internal commercial plan. */
export function stripePriceEnvKeyForPlan(id: CommercialPlanId): string {
  switch (id) {
    case "drive_plus_monthly":
      return "STRIPE_PRICE_DRIVE_PLUS_MONTHLY";
    case "drive_plus_yearly":
      return "STRIPE_PRICE_DRIVE_PLUS_YEARLY";
    case "drive_music_monthly":
      return "STRIPE_PRICE_DRIVE_MUSIC_MONTHLY";
    case "drive_music_yearly":
      return "STRIPE_PRICE_DRIVE_MUSIC_YEARLY";
    case "drive_unlimited_monthly":
      return "STRIPE_PRICE_DRIVE_UNLIMITED_MONTHLY";
    case "drive_unlimited_yearly":
      return "STRIPE_PRICE_DRIVE_UNLIMITED_YEARLY";
    case "drive_plus_lifetime":
      return "STRIPE_PRICE_DRIVE_PLUS_LIFETIME";
    case "founders_pack":
      return "STRIPE_PRICE_FOUNDERS_PACK";
  }
}
