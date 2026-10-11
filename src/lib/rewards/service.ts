import { randomUUID } from "node:crypto";

import {
  fullLibraryWeekendWindow,
  openEndedFromClaim,
  sound48hWindow,
  soundPack7dWindow,
} from "./access-windows";
import { getActiveCampaign } from "./campaign-config";
import { isRewardsEnabled } from "./flag";
import { fulfilClaim, retryFulfilment } from "./fulfilment";
import { deterministicReservationId } from "./grant-ids";
import { formatUtcIso, nextUtcMonthStart, utcMonthPeriodFromInstant } from "./period";
import {
  getClaimById,
  getClaimForPeriod,
  insertClaimExclusive,
  isInventoryAvailable,
  listCockpitThemesForAccount,
  listDiscountReservationsForAccount,
} from "./store";
import type {
  ClaimSoundSpinInput,
  ClaimSoundSpinResult,
  ClaimedRewardSnapshot,
  PublicClaimView,
  RewardAudience,
  SoundSpinCampaignConfig,
  SoundSpinPublicStatus,
  WeightedRewardDefinition,
} from "./types";
import {
  probabilityPercents,
  selectWeightedReward,
  validateAndBuildPool,
} from "./weights";

function toPublicClaim(
  claim: NonNullable<ReturnType<typeof getClaimById>>,
  nowMs: number,
): PublicClaimView {
  const outcome: PublicClaimView["outcome"] = {
    rewardId: claim.outcome.rewardId,
    kind: claim.outcome.kind,
    label: claim.outcome.label,
    termsSummary: claim.outcome.termsSummary,
    accessStartsAtUtc: formatUtcIso(claim.outcome.accessStartsAtUtc),
    accessEndsAtUtc:
      claim.outcome.accessEndsAtUtc != null
        ? formatUtcIso(claim.outcome.accessEndsAtUtc)
        : null,
  };
  if (claim.outcome.profileId) outcome.profileId = claim.outcome.profileId;
  if (claim.outcome.packProfileIds) outcome.packProfileIds = claim.outcome.packProfileIds;
  if (claim.outcome.themeId) outcome.themeId = claim.outcome.themeId;
  if (claim.outcome.discountPercent != null) {
    outcome.discountPercent = claim.outcome.discountPercent;
  }
  return {
    claimId: claim.claimId,
    periodKey: claim.periodKey,
    status: claim.status,
    outcome,
    nextEligibilityAtUtc: formatUtcIso(nextUtcMonthStart(Math.max(nowMs, claim.createdAtUtc))),
  };
}

function buildAccessWindow(def: WeightedRewardDefinition, claimAtUtc: number) {
  switch (def.kind) {
    case "sound_48h":
      return sound48hWindow(claimAtUtc);
    case "sound_pack_7d":
      return soundPack7dWindow(claimAtUtc);
    case "full_library_weekend":
      return fullLibraryWeekendWindow(claimAtUtc);
    case "one_payment_discount":
      return {
        startsAtUtc: claimAtUtc,
        endsAtUtc: claimAtUtc + 30 * 24 * 60 * 60 * 1000,
      };
    case "cockpit_theme":
      return openEndedFromClaim(claimAtUtc);
    default: {
      const _e: never = def.kind;
      throw new Error(`Unhandled kind ${_e}`);
    }
  }
}

function snapshotReward(
  def: WeightedRewardDefinition,
  claimAtUtc: number,
  claimId: string,
): ClaimedRewardSnapshot {
  const window = buildAccessWindow(def, claimAtUtc);
  const snapshot: ClaimedRewardSnapshot = {
    rewardId: def.rewardId,
    kind: def.kind,
    label: def.label,
    termsSummary: def.termsSummary,
    accessStartsAtUtc: window.startsAtUtc,
    accessEndsAtUtc: window.endsAtUtc,
    grantIds: [],
  };
  if (def.profileId) snapshot.profileId = def.profileId;
  if (def.packProfileIds) snapshot.packProfileIds = def.packProfileIds;
  if (def.themeId) snapshot.themeId = def.themeId;
  if (def.discountPercent != null) snapshot.discountPercent = def.discountPercent;
  if (def.kind === "one_payment_discount") {
    snapshot.discountReservationId = deterministicReservationId(claimId);
  }
  return snapshot;
}

function poolForAudience(campaign: SoundSpinCampaignConfig, audience: RewardAudience) {
  return audience === "paid" ? campaign.pools.paid : campaign.pools.free;
}

function resolveSelectableReward(
  campaign: SoundSpinCampaignConfig,
  audience: RewardAudience,
  periodKey: string,
):
  | { ok: true; reward: WeightedRewardDefinition }
  | { ok: false; reason: string } {
  const poolConfig = poolForAudience(campaign, audience);
  const validated = validateAndBuildPool(poolConfig.rewards);
  if (!validated.ok) return { ok: false, reason: validated.reason };

  const drawn = selectWeightedReward(validated.pool);
  if (
    isInventoryAvailable(
      campaign.campaignId,
      periodKey,
      drawn.rewardId,
      drawn.inventoryLimit,
    )
  ) {
    return { ok: true, reward: drawn };
  }

  const fallbackId = poolConfig.inventoryFallbackRewardId;
  if (!fallbackId) {
    return {
      ok: false,
      reason: `Inventory exhausted for ${drawn.rewardId} and no declared fallback`,
    };
  }
  const fallback = poolConfig.rewards.find((r) => r.rewardId === fallbackId);
  if (!fallback) {
    return { ok: false, reason: `Declared fallback ${fallbackId} missing from pool` };
  }
  if (
    !isInventoryAvailable(
      campaign.campaignId,
      periodKey,
      fallback.rewardId,
      fallback.inventoryLimit,
    )
  ) {
    return {
      ok: false,
      reason: `Inventory exhausted for ${drawn.rewardId}; fallback ${fallbackId} also unavailable`,
    };
  }
  return { ok: true, reward: fallback };
}

export function getSoundSpinStatus(input: {
  accountId: string | null;
  audience: RewardAudience | null;
  nowMs?: number;
}): SoundSpinPublicStatus {
  const nowMs = input.nowMs ?? Date.now();
  const rewardsEnabled = isRewardsEnabled();
  const campaign = getActiveCampaign();
  const period = utcMonthPeriodFromInstant(nowMs);

  if (!rewardsEnabled) {
    return {
      rewardsEnabled: false,
      claimingEnabled: false,
      campaign: null,
      audience: input.audience,
      alreadyClaimed: false,
      claim: null,
      displayedOdds: [],
      wheelSegmentsProportionalToOdds: false,
      disableReason: "Rewards are disabled until campaign configuration is complete.",
    };
  }

  const audience = input.audience ?? "free";
  const poolConfig = poolForAudience(campaign, audience);
  const validated = validateAndBuildPool(poolConfig.rewards);
  const percents = validated.ok ? probabilityPercents(validated.pool) : [];

  const displayedOdds = validated.ok
    ? poolConfig.rewards.map((r, i) => ({
        rewardId: r.rewardId,
        label: r.label,
        kind: r.kind,
        weight: r.weight,
        probabilityPercent: percents[i]!,
        termsSummary: r.termsSummary,
      }))
    : [];

  let disableReason: string | undefined;
  if (!campaign.enabled) {
    disableReason = "Campaign is not enabled. Claiming stays off until configuration is complete.";
  } else if (!validated.ok) {
    disableReason = `Reward pool invalid: ${validated.reason}`;
  } else if (!input.accountId) {
    disableReason = "Sign in with a verified account to claim.";
  }

  const claimingEnabled =
    rewardsEnabled &&
    campaign.enabled &&
    validated.ok &&
    Boolean(input.accountId);

  const existing =
    input.accountId
      ? getClaimForPeriod(input.accountId, campaign.campaignId, period.periodKey)
      : null;

  const status: SoundSpinPublicStatus = {
    rewardsEnabled: true,
    claimingEnabled: claimingEnabled && !existing,
    campaign: {
      campaignId: campaign.campaignId,
      configVersion: campaign.configVersion,
      title: campaign.title,
      description: campaign.description,
      stagingIllustrativeOnly: campaign.stagingIllustrativeOnly,
      timezoneNote: campaign.timezoneNote,
      accessStartsAt: campaign.accessStartsAt,
      periodKey: period.periodKey,
      periodStartsAtUtc: formatUtcIso(period.startsAtUtc),
      periodEndsAtUtcExclusive: formatUtcIso(period.endsAtUtcExclusive),
      nextEligibilityAtUtc: formatUtcIso(period.endsAtUtcExclusive),
    },
    audience: input.audience,
    alreadyClaimed: Boolean(existing),
    claim: existing ? toPublicClaim(existing, nowMs) : null,
    displayedOdds,
    wheelSegmentsProportionalToOdds: false,
  };
  if (disableReason) status.disableReason = disableReason;
  return status;
}

export function claimSoundSpin(input: ClaimSoundSpinInput): ClaimSoundSpinResult {
  const nowMs = input.nowMs ?? Date.now();

  if (!isRewardsEnabled()) {
    return {
      ok: false,
      error: "rewards_disabled",
      message: "Rewards are disabled until campaign configuration is complete.",
    };
  }

  if (!input.accountId) {
    return {
      ok: false,
      error: "not_authenticated",
      message: "Verified account required.",
    };
  }

  const idem = input.idempotencyKey?.trim();
  if (!idem || idem.length < 8 || idem.length > 128) {
    return {
      ok: false,
      error: "invalid_idempotency_key",
      message: "Idempotency key must be 8–128 characters.",
    };
  }

  const campaign = getActiveCampaign();
  if (!campaign.enabled) {
    return {
      ok: false,
      error: "campaign_disabled",
      message: "Campaign is not enabled.",
    };
  }

  const period = utcMonthPeriodFromInstant(nowMs);
  const existingPeriod = getClaimForPeriod(
    input.accountId,
    campaign.campaignId,
    period.periodKey,
  );
  if (existingPeriod) {
    const refreshed =
      existingPeriod.status === "fulfilled"
        ? existingPeriod
        : retryFulfilment(existingPeriod, nowMs);
    return {
      ok: true,
      claim: toPublicClaim(refreshed, nowMs),
      reusedExisting: true,
    };
  }

  const selected = resolveSelectableReward(campaign, input.audience, period.periodKey);
  if (!selected.ok) {
    return {
      ok: false,
      error: "pool_invalid",
      message: selected.reason,
    };
  }

  const claimId = randomUUID();
  const outcome = snapshotReward(selected.reward, nowMs, claimId);
  const record = {
    claimId,
    accountId: input.accountId,
    campaignId: campaign.campaignId,
    configVersion: campaign.configVersion,
    periodKey: period.periodKey,
    audience: input.audience,
    idempotencyKey: idem,
    status: "pending" as const,
    outcome,
    createdAtUtc: nowMs,
    updatedAtUtc: nowMs,
    fulfilmentAttempts: 0,
  };

  // Record outcome BEFORE animation / client reveal (authoritative).
  const inserted = insertClaimExclusive(record);
  if (!inserted.inserted) {
    const refreshed =
      inserted.claim.status === "fulfilled"
        ? inserted.claim
        : retryFulfilment(inserted.claim, nowMs);
    return {
      ok: true,
      claim: toPublicClaim(refreshed, nowMs),
      reusedExisting: true,
    };
  }

  const fulfilled = fulfilClaim(inserted.claim, nowMs);
  return {
    ok: true,
    claim: toPublicClaim(fulfilled, nowMs),
    reusedExisting: false,
  };
}

/** Scoped user read — never returns another account's claim. */
export function getClaimForAccount(
  accountId: string,
  claimId: string,
  nowMs: number = Date.now(),
): PublicClaimView | null {
  const claim = getClaimById(claimId);
  if (!claim || claim.accountId !== accountId) return null;
  return toPublicClaim(claim, nowMs);
}

export function getAccountRewardExtras(accountId: string) {
  return {
    cockpitThemes: listCockpitThemesForAccount(accountId),
    discountReservations: listDiscountReservationsForAccount(accountId).map((r) => ({
      reservationId: r.reservationId,
      discountPercent: r.discountPercent,
      status: r.status,
      expiresAtUtc: formatUtcIso(r.expiresAtUtc),
    })),
  };
}
