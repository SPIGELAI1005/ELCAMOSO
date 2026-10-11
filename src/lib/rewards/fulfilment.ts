import { upsertEntitlementGrant } from "@/lib/entitlements/grants";

import { deterministicGrantId, deterministicReservationId } from "./grant-ids";
import {
  unlockCockpitTheme,
  updateClaim,
  upsertDiscountReservation,
} from "./store";
import type { RewardClaimRecord } from "./types";

let forceFulfilmentFailureForTests = false;

/** Test-only: next fulfilClaim call throws once after marking attempt. */
export function setForceFulfilmentFailureForTests(value: boolean): void {
  forceFulfilmentFailureForTests = value;
}

/**
 * Apply durable grants / reservations for a recorded claim.
 * Idempotent: uses deterministic grant ids derived from claimId.
 */
export function fulfilClaim(claim: RewardClaimRecord, nowMs: number = Date.now()): RewardClaimRecord {
  const attempts = claim.fulfilmentAttempts + 1;
  let working: RewardClaimRecord = {
    ...claim,
    fulfilmentAttempts: attempts,
    updatedAtUtc: nowMs,
  };
  updateClaim(working);

  if (forceFulfilmentFailureForTests) {
    forceFulfilmentFailureForTests = false;
    working = {
      ...working,
      status: "failed",
      lastFulfilmentError: "forced_fulfilment_failure",
      updatedAtUtc: nowMs,
    };
    return updateClaim(working);
  }

  try {
    const grantIds: string[] = [];
    const source = `sound_spin:${claim.campaignId}:v${claim.configVersion}:${claim.claimId}`;
    const outcome = claim.outcome;

    switch (outcome.kind) {
      case "sound_48h": {
        if (!outcome.profileId) throw new Error("sound_48h missing profileId");
        const id = deterministicGrantId(claim.claimId, `profile:${outcome.profileId}`);
        upsertEntitlementGrant({
          id,
          accountId: claim.accountId,
          kind: "reward_profile",
          profileId: outcome.profileId,
          entitlement: null,
          expiresAt: outcome.accessEndsAtUtc,
          source,
          createdAt: claim.createdAtUtc,
        });
        grantIds.push(id);
        break;
      }
      case "sound_pack_7d": {
        const profiles = outcome.packProfileIds ?? [];
        if (profiles.length === 0) throw new Error("sound_pack_7d missing packProfileIds");
        for (const profileId of profiles) {
          const id = deterministicGrantId(claim.claimId, `profile:${profileId}`);
          upsertEntitlementGrant({
            id,
            accountId: claim.accountId,
            kind: "reward_profile",
            profileId,
            entitlement: null,
            expiresAt: outcome.accessEndsAtUtc,
            source,
            createdAt: claim.createdAtUtc,
          });
          grantIds.push(id);
        }
        break;
      }
      case "full_library_weekend": {
        const id = deterministicGrantId(claim.claimId, "entitlement:all_sound_profiles");
        upsertEntitlementGrant({
          id,
          accountId: claim.accountId,
          kind: "reward_entitlement",
          profileId: null,
          entitlement: "all_sound_profiles",
          expiresAt: outcome.accessEndsAtUtc,
          source,
          createdAt: claim.createdAtUtc,
        });
        grantIds.push(id);
        break;
      }
      case "cockpit_theme": {
        if (!outcome.themeId) throw new Error("cockpit_theme missing themeId");
        unlockCockpitTheme(claim.accountId, outcome.themeId);
        break;
      }
      case "one_payment_discount": {
        const reservationId =
          outcome.discountReservationId ?? deterministicReservationId(claim.claimId);
        const expiresAtUtc =
          outcome.accessEndsAtUtc ?? claim.createdAtUtc + 30 * 24 * 60 * 60 * 1000;
        upsertDiscountReservation({
          reservationId,
          accountId: claim.accountId,
          claimId: claim.claimId,
          discountPercent: outcome.discountPercent ?? 0,
          status: "reserved",
          createdAtUtc: claim.createdAtUtc,
          expiresAtUtc,
        });
        working = {
          ...working,
          outcome: { ...outcome, discountReservationId: reservationId },
        };
        break;
      }
      default: {
        const _exhaustive: never = outcome.kind;
        throw new Error(`Unknown reward kind ${_exhaustive}`);
      }
    }

    const { lastFulfilmentError: _drop, ...rest } = working;
    working = {
      ...rest,
      status: "fulfilled",
      outcome: { ...working.outcome, grantIds: grantIds.length ? grantIds : working.outcome.grantIds },
      updatedAtUtc: nowMs,
    };
    return updateClaim(working);
  } catch (err) {
    const message = err instanceof Error ? err.message : "fulfilment_error";
    working = {
      ...working,
      status: "failed",
      lastFulfilmentError: message,
      updatedAtUtc: nowMs,
    };
    return updateClaim(working);
  }
}

/** Retry fulfilment for failed/pending claims without changing the recorded outcome. */
export function retryFulfilment(claim: RewardClaimRecord, nowMs?: number): RewardClaimRecord {
  if (claim.status === "fulfilled") return claim;
  return fulfilClaim(claim, nowMs);
}
