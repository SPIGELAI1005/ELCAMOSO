/** Commercial plan - independent of Stripe product/price ids. */
export type Plan = "FREE" | "DRIVE_PLUS";

/** Feature capability granted to a user. Never derived from Stripe directly. */
export type Entitlement =
  | "basic_drive"
  | "basic_sound_profiles"
  | "dynamic_drive"
  | "virtual_transmission"
  | "rev_match"
  | "advanced_transients"
  | "phone_sensor"
  | "all_sound_profiles"
  | "advanced_controls"
  | "vehicle_telemetry"
  | "symphony_essential"
  | "symphony_all"
  | "worlds_sampler"
  | "worlds_all"
  | "fusion"
  | "drive_dna"
  | "drive_song_basic"
  | "drive_song_full"
  | "drive_reel"
  | "journey_history_local"
  | "journey_history_full"
  | "journey_remix"
  | "basic_share"
  | "studio_sound"
  | "studio_symphony"
  | "studio_fusion"
  | "premium_presets"
  | "experience_drops";

/** Paid subscription lifecycle (billing authority updates this later via webhooks). */
export type SubscriptionStatus = "none" | "active" | "trialing" | "past_due" | "canceled";

/** Temporary trial overlay - can grant entitlements beyond the base plan. */
export type TrialStatus = "none" | "active" | "expired";

/** User entitlement context - source of truth for feature gates (not Stripe). */
export interface EntitlementUser {
  /** ELCAMOSO account id when authenticated; null for anonymous default. */
  accountId: string | null;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  trialStatus: TrialStatus;
  /** Extra entitlements while trial is active (unioned with plan entitlements). */
  trialEntitlements?: readonly Entitlement[];
  /** Epoch ms when trial ends; null = no time limit (dev only). */
  trialEndsAt?: number | null;
  /** Monotonic revision for cache invalidation when server snapshot updates. */
  revision?: number;
}

/** Resolved entitlement state for UI and gates. */
export interface EntitlementSnapshot {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  trialStatus: TrialStatus;
  entitlements: readonly Entitlement[];
  trialActive: boolean;
  revision: number;
}
