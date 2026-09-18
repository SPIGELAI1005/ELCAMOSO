import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import type { SubscriptionAccessReason } from "@/lib/billing/subscription-access-policy";
import { resolveLocalSubscriptionAccess } from "@/lib/billing/resilience/local-access";
import {
  getBillingHealthSnapshot,
  listFailedWebhookEvents,
} from "@/lib/billing/resilience/reconciliation";
import { getSubscriptionRepository } from "@/lib/billing/subscription-repository-memory";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import type { Subscription } from "@/lib/billing/types";
import { getUserBillingRepository } from "@/lib/billing/user-billing-store";
import type { BillingStatus } from "@/lib/billing/status";
import { getDynamicDriveTrialService } from "@/lib/dynamic-drive-trial/service";
import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";
import { TRIAL_DRIVE_PLUS_ENTITLEMENTS } from "@/lib/entitlements/plans";
import { buildEntitlementSnapshot } from "@/lib/entitlements/resolve";
import { trialGrantsDrivePlusEntitlements } from "@/lib/entitlements/service";
import type { Entitlement, EntitlementUser, Plan } from "@/lib/entitlements/types";

export interface BillingAdminDiagnostics {
  userId: string;
  email: string | null;
  internalPlan: Plan;
  entitlements: readonly Entitlement[];
  trial: DynamicDriveTrialSnapshot | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  localSubscriptionStatus: BillingStatus | "none";
  localAccessReason: SubscriptionAccessReason | "free";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastSubscriptionUpdate: string | null;
  stripeConfigured: boolean;
  failedWebhookCount: number;
  recentFailedWebhooks: Array<{
    stripeEventId: string;
    eventType: string;
    errorMessage?: string;
  }>;
}

async function findLatestSubscriptionForUser(userId: string): Promise<Subscription | null> {
  const repo = getSubscriptionRepository();
  if (repo.findLatestByUserId) {
    return repo.findLatestByUserId(userId);
  }
  return null;
}

function resolveEntitlementUserForAccountId(
  userId: string,
  trialSnapshot: DynamicDriveTrialSnapshot | null,
  now: number,
): EntitlementUser {
  let plan: Plan = "FREE";
  let subscriptionStatus: EntitlementUser["subscriptionStatus"] = "none";
  let trialStatus: EntitlementUser["trialStatus"] = "none";
  let trialEntitlements: Entitlement[] | undefined;
  let trialEndsAt: number | null = null;
  let revision = 0;

  const subscription = getSubscriptionForUser(userId);
  if (subscription && hasDrivePlusSubscriptionAccess(subscription, now)) {
    plan = "DRIVE_PLUS";
    subscriptionStatus =
      subscription.status === "trialing"
        ? "trialing"
        : subscription.status === "active"
          ? "active"
          : subscription.status === "past_due"
            ? "past_due"
            : subscription.status === "canceled" || subscription.status === "paused"
              ? "canceled"
              : "none";
    revision += 1;
  }

  if (trialSnapshot && trialGrantsDrivePlusEntitlements(trialSnapshot)) {
    trialStatus = "active";
    trialEntitlements = [...TRIAL_DRIVE_PLUS_ENTITLEMENTS];
    trialEndsAt = trialSnapshot.expiresAt;
    revision += 2;
  } else if (trialSnapshot?.status === "expired") {
    trialStatus = "expired";
  }

  return {
    accountId: userId,
    plan,
    subscriptionStatus,
    trialStatus,
    ...(trialEntitlements ? { trialEntitlements } : {}),
    trialEndsAt,
    revision,
  };
}

/** Read-only billing diagnostics for an internal user - never mutates entitlements. */
export async function buildBillingAdminDiagnostics(
  userId: string,
  email: string | null = null,
  now = Date.now(),
): Promise<BillingAdminDiagnostics> {
  const local = resolveLocalSubscriptionAccess(userId, now);
  const runtime = getSubscriptionForUser(userId);
  const persisted = await findLatestSubscriptionForUser(userId);
  const stripeCustomerId = await getUserBillingRepository().getStripeCustomerId(userId);
  const trial = await getDynamicDriveTrialService().getStatus(userId, new Date(now));
  const entitlementUser = resolveEntitlementUserForAccountId(userId, trial, now);
  const snapshot = buildEntitlementSnapshot(entitlementUser, now);
  const health = await getBillingHealthSnapshot(userId);
  const recentFailedWebhooks = await listFailedWebhookEvents(10);

  return {
    userId,
    email,
    internalPlan: snapshot.plan,
    entitlements: snapshot.entitlements,
    trial,
    stripeCustomerId,
    stripeSubscriptionId: persisted?.providerSubscriptionId ?? null,
    localSubscriptionStatus: runtime?.status ?? "none",
    localAccessReason: local.reason,
    currentPeriodEnd:
      runtime?.currentPeriodEnd?.toISOString() ??
      persisted?.currentPeriodEnd?.toISOString() ??
      null,
    cancelAtPeriodEnd: runtime?.cancelAtPeriodEnd ?? persisted?.cancelAtPeriodEnd ?? false,
    lastSubscriptionUpdate: persisted?.updatedAt?.toISOString() ?? null,
    stripeConfigured: health.stripeConfigured,
    failedWebhookCount: health.failedWebhookCount,
    recentFailedWebhooks,
  };
}
