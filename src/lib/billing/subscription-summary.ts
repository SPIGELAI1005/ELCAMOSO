import {
  evaluateSubscriptionAccess,
  hasDrivePlusSubscriptionAccess,
} from "@/lib/billing/subscription-access-policy";
import type { UserSubscriptionRecord } from "@/lib/billing/subscription-store";
import { formatTrialRemainingMinutes } from "@/lib/dynamic-drive-trial/display";
import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";

export type SubscriptionStatusHeadline = "Active" | "Ending soon" | "Payment issue";

export interface TrialBillingState {
  label: string;
  detail: string | null;
}

export interface SubscriptionSummary {
  planLabel: "Free" | "Drive+";
  intervalLabel: "Monthly" | "Annual" | null;
  statusHeadline: SubscriptionStatusHeadline | null;
  statusDetail: string | null;
  actionHint: string | null;
  canManageSubscription: boolean;
  canUpgrade: boolean;
  trial: TrialBillingState | null;
}

function formatSummaryDate(date: Date, locale = "en-US"): string {
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function intervalLabel(interval: UserSubscriptionRecord["interval"]): "Monthly" | "Annual" | null {
  if (interval === "month") return "Monthly";
  if (interval === "year") return "Annual";
  return null;
}

export function buildTrialBillingState(
  snapshot: DynamicDriveTrialSnapshot | null,
  hasDrivePlus: boolean,
): TrialBillingState | null {
  if (!snapshot || hasDrivePlus || snapshot.status === "converted") return null;

  if (snapshot.status === "available") {
    return {
      label: "Dynamic Drive preview",
      detail: "30 min · up to 3 drives · no card",
    };
  }

  if (snapshot.status === "active" && snapshot.canUseDynamicDrive) {
    const drives =
      snapshot.remainingSessions === 1
        ? "1 drive left"
        : `${snapshot.remainingSessions} drives left`;
    return {
      label: "Dynamic Drive preview",
      detail: `${formatTrialRemainingMinutes(snapshot.remainingSeconds)} · ${drives}`,
    };
  }

  if (snapshot.status === "exhausted" || snapshot.status === "expired") {
    return {
      label: "Dynamic Drive preview",
      detail: "Preview complete",
    };
  }

  return null;
}

/** Client-safe subscription display - no Stripe ids or internal billing states. */
export function buildSubscriptionSummary(
  subscription: UserSubscriptionRecord | null,
  canManageSubscription: boolean,
  now = Date.now(),
  locale = "en-US",
  trialSnapshot: DynamicDriveTrialSnapshot | null = null,
): SubscriptionSummary {
  const hasDrivePlus = Boolean(subscription && hasDrivePlusSubscriptionAccess(subscription, now));

  if (!hasDrivePlus) {
    return {
      planLabel: "Free",
      intervalLabel: null,
      statusHeadline: null,
      statusDetail: null,
      actionHint: null,
      canManageSubscription: false,
      canUpgrade: true,
      trial: buildTrialBillingState(trialSnapshot, false),
    };
  }

  const access = evaluateSubscriptionAccess(subscription!, now);
  const periodEnd = subscription!.currentPeriodEnd;
  const formattedPeriodEnd = periodEnd ? formatSummaryDate(periodEnd, locale) : null;

  if (access.reason === "past_due_grace") {
    return {
      planLabel: "Drive+",
      intervalLabel: intervalLabel(subscription!.interval),
      statusHeadline: "Payment issue",
      statusDetail: access.effectiveUntil
        ? `Access until ${formatSummaryDate(access.effectiveUntil, locale)}`
        : null,
      actionHint: "Update payment in plan settings",
      canManageSubscription,
      canUpgrade: false,
      trial: buildTrialBillingState(trialSnapshot, true),
    };
  }

  const isCanceling = subscription!.cancelAtPeriodEnd || access.reason === "cancel_at_period_end";

  if (isCanceling && formattedPeriodEnd) {
    return {
      planLabel: "Drive+",
      intervalLabel: intervalLabel(subscription!.interval),
      statusHeadline: "Ending soon",
      statusDetail: `Available until ${formattedPeriodEnd}`,
      actionHint: null,
      canManageSubscription,
      canUpgrade: false,
      trial: buildTrialBillingState(trialSnapshot, true),
    };
  }

  if (access.reason === "trialing" && formattedPeriodEnd) {
    return {
      planLabel: "Drive+",
      intervalLabel: intervalLabel(subscription!.interval),
      statusHeadline: "Active",
      statusDetail: `Trial until ${formattedPeriodEnd}`,
      actionHint: null,
      canManageSubscription,
      canUpgrade: false,
      trial: buildTrialBillingState(trialSnapshot, true),
    };
  }

  return {
    planLabel: "Drive+",
    intervalLabel: intervalLabel(subscription!.interval),
    statusHeadline: "Active",
    statusDetail: formattedPeriodEnd ? `Renews ${formattedPeriodEnd}` : null,
    actionHint: null,
    canManageSubscription,
    canUpgrade: false,
    trial: buildTrialBillingState(trialSnapshot, true),
  };
}
