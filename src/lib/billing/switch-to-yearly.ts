/**
 * Monthly Drive+ / Drive the Music → yearly of the same package.
 * A switch during the Founders Pack window counts as a Pack purchase.
 */
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import { getStripeClient } from "@/lib/billing/stripe/client";
import { resolveStripePriceId } from "@/lib/billing/stripe/config";
import { syncStripeSubscriptionRecord } from "@/lib/billing/stripe/subscription-sync";
import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import type { Subscription } from "@/lib/billing/types";
import { applyFoundersPackFromYearlySubscription } from "@/lib/founders/founders.server";
import { isFoundersPackQualifyingPurchaseTime } from "@/lib/founders/founders";

export const FOUNDERS_PACK_SWITCH_AT_META = "foundersPackSwitchAt";

export function canSwitchMonthlyToYearly(
  subscription: Pick<Subscription, "plan" | "interval" | "status"> | null | undefined,
  now = Date.now(),
): boolean {
  if (!subscription) return false;
  if (subscription.interval !== "month") return false;
  if (subscription.plan !== "DRIVE_PLUS" && subscription.plan !== "DRIVE_MUSIC") return false;
  return hasDrivePlusSubscriptionAccess(subscription, now);
}

export function parseFoundersPackSwitchAt(
  metadata: Record<string, string> | null | undefined,
): number | null {
  const raw = metadata?.[FOUNDERS_PACK_SWITCH_AT_META];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function switchMonthlySubscriptionToYearly(
  userId: string,
  now = Date.now(),
): Promise<{ switched: true; until: number | null }> {
  const rec = await getSubscriptionRepository().findLatestByUserId?.(userId);
  if (!rec || !canSwitchMonthlyToYearly(rec, now)) {
    throw new Error("No monthly Drive+ or Drive the Music subscription to switch.");
  }
  const yearlyId = rec.plan === "DRIVE_MUSIC" ? "drive_music_yearly" : "drive_plus_yearly";
  const yearlyPrice = resolveStripePriceId(yearlyId);
  const stripe = getStripeClient();
  const stripeSub = await stripe.subscriptions.retrieve(rec.providerSubscriptionId);
  const itemId = stripeSub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription item missing");
  const updated = await stripe.subscriptions.update(rec.providerSubscriptionId, {
    items: [{ id: itemId, price: yearlyPrice }],
    proration_behavior: "create_prorations",
    metadata: {
      ...stripeSub.metadata,
      billingInterval: "year",
      interval: "yearly",
      elcamosoPlan: rec.plan,
      [FOUNDERS_PACK_SWITCH_AT_META]: String(now),
    },
  });
  const saved = await syncStripeSubscriptionRecord(updated);
  const purchasedAt = isFoundersPackQualifyingPurchaseTime(now) ? now : saved.createdAt.getTime();
  const applied = await applyFoundersPackFromYearlySubscription(saved, now, { purchasedAt });
  return { switched: true, until: applied.until };
}
