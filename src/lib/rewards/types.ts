export type RewardAudience = "free" | "paid";

export type RewardOutcomeKind =
  | "sound_48h"
  | "sound_pack_7d"
  | "cockpit_theme"
  | "one_payment_discount"
  | "full_library_weekend";

export type FulfilmentStatus =
  | "pending"
  | "fulfilled"
  | "failed"
  | "disabled";

export interface WeightedRewardDefinition {
  rewardId: string;
  kind: RewardOutcomeKind;
  /** Finite nonnegative weight; pool total must be > 0 after validation. */
  weight: number;
  label: string;
  /** Human-readable terms shown before claim. */
  termsSummary: string;
  /** Profile id for sound_48h. */
  profileId?: string;
  /** Profile ids for sound_pack_7d. */
  packProfileIds?: string[];
  /** Cockpit theme id. */
  themeId?: string;
  /** Discount percent for one_payment_discount (illustrative staging). */
  discountPercent?: number;
  /** Optional inventory cap; when exhausted, pool is invalid unless fallback declared. */
  inventoryLimit?: number;
}

export interface RewardPoolConfig {
  audience: RewardAudience;
  rewards: WeightedRewardDefinition[];
  /**
   * Declared fallback reward id when selected outcome is inventory-unavailable.
   * Must exist in the same pool. If absent and inventory fails, claiming is disabled.
   */
  inventoryFallbackRewardId?: string;
}

export interface SoundSpinCampaignConfig {
  campaignId: string;
  /** Bumped when terms/weights change; snapshotted on each claim. */
  configVersion: number;
  title: string;
  description: string;
  /** UTC calendar month periods only for v1. */
  periodStrategy: "utc_calendar_month";
  /** When temporary access starts (v1). */
  accessStartsAt: "claim_time";
  timezoneNote: string;
  pools: {
    free: RewardPoolConfig;
    paid: RewardPoolConfig;
  };
  /**
   * Staging-only flag. Production campaigns must set this false and use
   * explicit reviewed probabilities — never invent business facts.
   */
  stagingIllustrativeOnly: boolean;
  enabled: boolean;
}

export interface ClaimedRewardSnapshot {
  rewardId: string;
  kind: RewardOutcomeKind;
  label: string;
  termsSummary: string;
  profileId?: string;
  packProfileIds?: string[];
  themeId?: string;
  discountPercent?: number;
  /** Access window (UTC ms). */
  accessStartsAtUtc: number;
  accessEndsAtUtc: number | null;
  /** Grant ids created during fulfilment (idempotent). */
  grantIds: string[];
  /** Discount reservation id when kind is one_payment_discount. */
  discountReservationId?: string;
}

export interface RewardClaimRecord {
  claimId: string;
  accountId: string;
  campaignId: string;
  configVersion: number;
  periodKey: string;
  audience: RewardAudience;
  idempotencyKey: string;
  status: FulfilmentStatus;
  outcome: ClaimedRewardSnapshot;
  createdAtUtc: number;
  updatedAtUtc: number;
  fulfilmentAttempts: number;
  lastFulfilmentError?: string;
}

/** Durable reward discount lifecycle (Prompt 12 reserve → Prompt 13 apply/consume). */
export type DiscountReservationStatus =
  | "reserved"
  | "applied"
  | "consumed"
  | "expired"
  | "pending"
  | "ineligible"
  | "failed";

export type RewardDiscountCase = "checkout_new_monthly" | "renewal_next_monthly";

export interface DiscountReservation {
  reservationId: string;
  accountId: string;
  claimId: string;
  discountPercent: number;
  status: DiscountReservationStatus;
  createdAtUtc: number;
  expiresAtUtc: number;
  /** Set when a Stripe apply path is chosen. */
  discountCase?: RewardDiscountCase;
  stripeCustomerId?: string;
  stripeCouponId?: string;
  stripeCheckoutSessionId?: string;
  stripeSubscriptionId?: string;
  /** Clearly identified future/target invoice when known. */
  stripeInvoiceId?: string;
  stripeDiscountId?: string;
  /** Stable key for Stripe Idempotency-Key. */
  applyIdempotencyKey?: string;
  lastError?: string;
  ineligibleReason?: string;
  appliedAtUtc?: number;
  consumedAtUtc?: number;
  /** Test-mode / diagnostics: expected amounts after percent off (cents). */
  expectedSubtotalCents?: number;
  expectedDiscountAmountCents?: number;
  expectedInvoiceTotalCents?: number;
}

export interface SoundSpinPublicStatus {
  rewardsEnabled: boolean;
  claimingEnabled: boolean;
  campaign: {
    campaignId: string;
    configVersion: number;
    title: string;
    description: string;
    stagingIllustrativeOnly: boolean;
    timezoneNote: string;
    accessStartsAt: "claim_time";
    periodKey: string;
    periodStartsAtUtc: string;
    periodEndsAtUtcExclusive: string;
    nextEligibilityAtUtc: string;
  } | null;
  audience: RewardAudience | null;
  alreadyClaimed: boolean;
  claim: PublicClaimView | null;
  /** Odds shown to the user for their pool (percentages sum ~100). */
  displayedOdds: Array<{
    rewardId: string;
    label: string;
    kind: RewardOutcomeKind;
    weight: number;
    probabilityPercent: number;
    termsSummary: string;
  }>;
  /** Wheel segments are decorative unless this is true. */
  wheelSegmentsProportionalToOdds: boolean;
  disableReason?: string;
}

export interface PublicClaimView {
  claimId: string;
  periodKey: string;
  status: FulfilmentStatus;
  outcome: {
    rewardId: string;
    kind: RewardOutcomeKind;
    label: string;
    termsSummary: string;
    accessStartsAtUtc: string;
    accessEndsAtUtc: string | null;
    profileId?: string;
    packProfileIds?: string[];
    themeId?: string;
    discountPercent?: number;
  };
  nextEligibilityAtUtc: string;
}

export interface ClaimSoundSpinInput {
  accountId: string;
  audience: RewardAudience;
  idempotencyKey: string;
  /** Optional clock override for tests. */
  nowMs?: number;
}

export type ClaimSoundSpinResult =
  | {
      ok: true;
      claim: PublicClaimView;
      reusedExisting: boolean;
    }
  | {
      ok: false;
      error:
        | "rewards_disabled"
        | "campaign_disabled"
        | "pool_invalid"
        | "not_authenticated"
        | "invalid_idempotency_key";
      message: string;
      claim?: PublicClaimView;
    };
