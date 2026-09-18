import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";
import { getDynamicDriveTrialService } from "@/lib/dynamic-drive-trial/service";
import { getAccountSession } from "@/lib/account/auth-service";
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import { TRIAL_DRIVE_PLUS_ENTITLEMENTS } from "@/lib/entitlements/plans";
import { buildEntitlementSnapshot } from "@/lib/entitlements/resolve";
import type {
  Entitlement,
  EntitlementSnapshot,
  EntitlementUser,
  SubscriptionStatus,
  TrialStatus,
} from "@/lib/entitlements/types";
import type { Plan } from "@/lib/entitlements/types";
import type { BillingStatus } from "@/lib/billing/status";

function mapBillingStatusToSubscription(status: BillingStatus): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "paused":
      return "canceled";
    default:
      return "none";
  }
}

/** Dynamic Drive preview trial grants full DRIVE+ entitlements while valid. */
export function trialGrantsDrivePlusEntitlements(
  snapshot: DynamicDriveTrialSnapshot | null | undefined,
): boolean {
  if (!snapshot) return false;
  if (snapshot.status === "converted" || snapshot.status === "expired") return false;
  if (snapshot.status === "available") return false;
  if (snapshot.remainingSeconds <= 0 && !snapshot.canUseDynamicDrive) return false;
  return snapshot.remainingSeconds > 0 || snapshot.canUseDynamicDrive;
}

export async function resolveEntitlementUser(input: {
  sessionToken?: string | null;
  now?: number;
}): Promise<EntitlementUser> {
  const now = input.now ?? Date.now();
  let accountId: string | null = null;
  let plan: Plan = "FREE";
  let subscriptionStatus: SubscriptionStatus = "none";
  let trialStatus: TrialStatus = "none";
  let trialEntitlements: Entitlement[] | undefined;
  let trialEndsAt: number | null = null;
  let revision = 0;

  if (input.sessionToken) {
    const session = getAccountSession(input.sessionToken, now);
    if (session) {
      accountId = session.userId;

      const subscription = getSubscriptionForUser(session.userId);
      if (subscription && hasDrivePlusSubscriptionAccess(subscription)) {
        plan = "DRIVE_PLUS";
        subscriptionStatus = mapBillingStatusToSubscription(subscription.status);
        revision += 1;
      }

      const trialSnapshot = await getDynamicDriveTrialService().getStatus(
        session.userId,
        new Date(now),
      );
      if (trialGrantsDrivePlusEntitlements(trialSnapshot)) {
        trialStatus = "active";
        trialEntitlements = [...TRIAL_DRIVE_PLUS_ENTITLEMENTS];
        trialEndsAt = trialSnapshot.expiresAt;
        revision += 2;
      } else if (trialSnapshot.status === "expired") {
        trialStatus = "expired";
      }
    }
  }

  return {
    accountId,
    plan,
    subscriptionStatus,
    trialStatus,
    ...(trialEntitlements ? { trialEntitlements } : {}),
    trialEndsAt,
    revision,
  };
}

export async function resolveEntitlementSnapshot(input: {
  sessionToken?: string | null;
  now?: number;
}): Promise<EntitlementSnapshot> {
  const user = await resolveEntitlementUser(input);
  return buildEntitlementSnapshot(user, input.now ?? Date.now());
}

export class EntitlementDeniedError extends Error {
  readonly entitlement: Entitlement;

  constructor(entitlement: Entitlement) {
    super(`Entitlement required: ${entitlement}`);
    this.name = "EntitlementDeniedError";
    this.entitlement = entitlement;
  }
}

export async function requireEntitlement(input: {
  sessionToken?: string | null;
  entitlement: Entitlement;
  now?: number;
}): Promise<EntitlementUser> {
  const user = await resolveEntitlementUser({
    ...(input.sessionToken !== undefined ? { sessionToken: input.sessionToken } : {}),
    ...(input.now !== undefined ? { now: input.now } : {}),
  });
  const snapshot = buildEntitlementSnapshot(user, input.now ?? Date.now());
  if (!snapshot.entitlements.includes(input.entitlement)) {
    throw new EntitlementDeniedError(input.entitlement);
  }
  return user;
}
