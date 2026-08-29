import type { CheckoutIntervalSlug, CheckoutPlanSlug } from "@/lib/billing/checkout-request";
import type { PremiumContext } from "@/lib/premium/contexts";
import type { AnalyticsEvent, AnalyticsName } from "@/lib/telemetry/analytics";
import { trackEvent } from "@/lib/telemetry/analytics";
import { ingestTelemetry } from "@/lib/telemetry/store";

export const MONETIZATION_ANALYTICS_NAMES = [
  "pricing_viewed",
  "dynamic_trial_offered",
  "dynamic_trial_started",
  "dynamic_trial_session_started",
  "dynamic_trial_session_completed",
  "dynamic_trial_low_remaining",
  "dynamic_trial_exhausted",
  "premium_feature_clicked",
  "upgrade_clicked",
  "checkout_started",
  "checkout_completed",
  "checkout_canceled",
  "subscription_started",
  "subscription_canceled",
  "plan_interval_selected",
] as const;

export type MonetizationAnalyticsName = (typeof MONETIZATION_ANALYTICS_NAMES)[number];

export type MonetizationPlanSlug = CheckoutPlanSlug | "free";

export interface MonetizationEventMeta {
  source?: string;
  plan?: MonetizationPlanSlug;
  interval?: CheckoutIntervalSlug;
  context?: PremiumContext | string;
  milestone?: number;
}

const BLOCKED_META_KEYS = new Set([
  "lat",
  "lng",
  "latitude",
  "longitude",
  "gps",
  "route",
  "telemetry",
  "accelerometer",
  "motion",
  "speed",
  "position",
]);

const MAX_META_VALUE_LENGTH = 80;

function isMonetizationEvent(name: AnalyticsName): name is MonetizationAnalyticsName {
  return (MONETIZATION_ANALYTICS_NAMES as readonly string[]).includes(name);
}

/** Strip disallowed keys and coarse-enrich monetization events. Never attach motion/GPS. */
export function sanitizeMonetizationMeta(
  meta?: MonetizationEventMeta,
): AnalyticsEvent["meta"] | undefined {
  if (!meta) return undefined;

  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (BLOCKED_META_KEYS.has(key.toLowerCase())) continue;
    if (value == null) continue;
    if (typeof value === "string") {
      out[key] = value.slice(0, MAX_META_VALUE_LENGTH);
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function trackMonetizationEvent(
  name: MonetizationAnalyticsName,
  meta?: MonetizationEventMeta,
): void {
  trackEvent(name, sanitizeMonetizationMeta(meta));
}

/** Server-side funnel events (Stripe webhooks) — same ingest path, no vendor. */
export function recordServerMonetizationEvent(
  name: MonetizationAnalyticsName,
  meta?: MonetizationEventMeta,
): void {
  const sanitized = sanitizeMonetizationMeta(meta);
  ingestTelemetry({
    installId: "server",
    events: [
      {
        name,
        at: Date.now(),
        ...(sanitized ? { meta: sanitized } : {}),
      },
    ],
    crashes: [],
  });
}

export function monetizationSourceFromPath(pathname: string): string {
  if (pathname.startsWith("/pricing")) return "pricing";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/drive")) return "drive";
  if (pathname.startsWith("/sounds")) return "sounds";
  if (pathname.startsWith("/upgrade")) return "cockpit_upgrade";
  return "app";
}

export function monetizationMetaFromStripeMetadata(
  metadata?: Record<string, string> | null,
): MonetizationEventMeta {
  const source =
    typeof metadata?.source === "string" && metadata.source.trim()
      ? metadata.source.trim()
      : "checkout";
  const interval =
    metadata?.interval === "monthly" || metadata?.interval === "yearly"
      ? metadata.interval
      : undefined;
  return {
    source,
    plan: "drive_plus",
    interval,
  };
}

export function isMonetizationAnalyticsName(name: string): name is MonetizationAnalyticsName {
  return isMonetizationEvent(name as AnalyticsName);
}
