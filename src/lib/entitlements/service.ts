import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";
import { getDynamicDriveTrialService } from "@/lib/dynamic-drive-trial/service";
import { getAccountSession } from "@/lib/account/auth-service";
import { hasDrivePlusSubscriptionAccess } from "@/lib/billing/subscription-access-policy";
import { getSubscriptionForUser } from "@/lib/billing/subscription-store";
import {
  activeGrantedEntitlements,
  activeGrantedProfileIds,
} from "@/lib/entitlements/grants";
import { getOfflineAccessLease } from "@/lib/entitlements/offline-lease";
import { ALL_ENTITLEMENTS, TRIAL_DRIVE_PLUS_ENTITLEMENTS } from "@/lib/entitlements/plans";
import { isAllowlistedAdminEmail } from "@/lib/admin/admin-access";
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
import { entitlementsForPlan } from "@/lib/entitlements/plans";
import { founderStatusFrom, isFounderDrivePlusActive } from "@/lib/founders/founders";
import type { FounderInfo } from "@/lib/entitlements/types";

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

  let grantedProfileIds: string[] = [];
  let grantedEntitlements: Entitlement[] = [];
  let founder: FounderInfo | null = null;

  if (input.sessionToken) {
    const session = getAccountSession(input.sessionToken, now);
    if (session) {
      accountId = session.userId;
      const { hydrateUserBillingState } = await import("@/lib/billing/durable-state.server");
      await hydrateUserBillingState(session.userId, { now });

      const subscription = getSubscriptionForUser(session.userId);
      if (subscription && hasDrivePlusSubscriptionAccess(subscription, now)) {
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

      grantedProfileIds = activeGrantedProfileIds(session.userId, now);
      grantedEntitlements = activeGrantedEntitlements(session.userId, now);
      if (grantedProfileIds.length || grantedEntitlements.length) revision += 4;

      // Admin test unlock: allowlisted admins (bootstrap + ELCAMOSO_ADMIN_EMAILS) get every
      // entitlement, resolved server-side from the signed session email (no DB needed).
      // Plan/subscription stay untouched so billing UI is unaffected.
      if (isAllowlistedAdminEmail(session.email)) {
        grantedEntitlements = [...new Set([...grantedEntitlements, ...ALL_ENTITLEMENTS])];
        revision += 8;
      }

      // Founders Pack: a verified session before the deadline claims a seat (atomic, capped).
      // Active Founders get the full Drive+ entitlement set until FOUNDER_DRIVE_PLUS_UNTIL.
      try {
        const { claimFounderSeat, foundersEnabled } = await import("@/lib/founders/founders.server");
        const rec = foundersEnabled()
          ? await claimFounderSeat(session.userId, session.email ?? null, now)
          : null;
        const status = rec ? founderStatusFrom(rec.founderAt) : null;
        if (status && rec) {
          const active = isFounderDrivePlusActive(rec.founderAt, now);
          founder = { ...status, seat: rec.seat, drivePlusActive: active, testCrewOptIn: rec.testCrewOptIn };
          if (active) {
            grantedEntitlements = [
              ...new Set([...grantedEntitlements, ...entitlementsForPlan("DRIVE_PLUS")]),
            ];
            revision += 16;
          }
        }
      } catch (error) {
        console.error("[founders] resolve failed", error instanceof Error ? error.message : error);
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
    grantedProfileIds,
    grantedEntitlements,
    revision,
    founder,
  };
}

export async function resolveEntitlementSnapshot(input: {
  sessionToken?: string | null;
  now?: number;
}): Promise<EntitlementSnapshot> {
  const now = input.now ?? Date.now();
  const user = await resolveEntitlementUser({ ...input, now });
  const lease = getOfflineAccessLease();
  const leaseExpires =
    lease && lease.accountId === user.accountId && lease.expiresAtUtc > now
      ? lease.expiresAtUtc
      : null;
  return buildEntitlementSnapshot(user, now, leaseExpires);
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
