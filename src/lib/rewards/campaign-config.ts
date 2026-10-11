import type { SoundSpinCampaignConfig } from "./types";

/**
 * Staging-only illustrative campaign.
 *
 * Probabilities and terms here are **not** production business facts.
 * Production must ship an explicitly reviewed config with
 * `stagingIllustrativeOnly: false` before enabling ELCAMOSO_REWARDS_ENABLED.
 */
export const STAGING_SOUND_SPIN_CAMPAIGN: SoundSpinCampaignConfig = {
  campaignId: "sound-spin-staging-v1",
  configVersion: 1,
  title: "Sound Spin",
  description:
    "One free spin each UTC calendar month. No paid spins. Motion data is never required.",
  periodStrategy: "utc_calendar_month",
  accessStartsAt: "claim_time",
  timezoneNote:
    "Campaign months and expiry times use Coordinated Universal Time (UTC). Temporary access starts at the moment you claim.",
  stagingIllustrativeOnly: true,
  /** Kept false so claiming stays off until ops explicitly enable a campaign. */
  enabled: false,
  pools: {
    free: {
      audience: "free",
      inventoryFallbackRewardId: "free-theme-midnight",
      rewards: [
        {
          rewardId: "free-sound-gt-v8-48h",
          kind: "sound_48h",
          weight: 35,
          label: "GT V8 for 48 hours",
          termsSummary:
            "Unlocks the GT V8 Sound Profile from claim time (UTC) for 48 hours.",
          profileId: "gt-v8",
        },
        {
          rewardId: "free-pack-sport-7d",
          kind: "sound_pack_7d",
          weight: 25,
          label: "Sport pack for 7 days",
          termsSummary:
            "Unlocks Racing V10, Turbo Inline-6, and Formula Electric from claim time (UTC) for 7 days.",
          packProfileIds: ["racing-v10", "turbo-inline-6", "formula-electric"],
        },
        {
          rewardId: "free-theme-midnight",
          kind: "cockpit_theme",
          weight: 20,
          label: "Midnight cockpit theme",
          termsSummary: "Adds the Midnight cockpit theme to your Garage permanently for this account.",
          themeId: "midnight",
        },
        {
          rewardId: "free-discount-15",
          kind: "one_payment_discount",
          weight: 12,
          label: "15% off one payment",
          termsSummary:
            "Reserves a one-time 15% discount for a single eligible payment. Not automatic enrolment. Expires 30 days after claim (UTC).",
          discountPercent: 15,
        },
        {
          rewardId: "free-library-weekend",
          kind: "full_library_weekend",
          weight: 8,
          label: "Full library weekend",
          termsSummary:
            "All Sound Profiles from claim time (UTC) until 23:59:59.999 UTC on the applicable Sunday (see Sound Spin terms), capped at 96 hours.",
        },
      ],
    },
    paid: {
      audience: "paid",
      // Paid users already have library access — do not offer full-library as the only valuable outcome.
      inventoryFallbackRewardId: "paid-theme-aurora",
      rewards: [
        {
          rewardId: "paid-theme-aurora",
          kind: "cockpit_theme",
          weight: 45,
          label: "Aurora cockpit theme",
          termsSummary: "Adds the Aurora cockpit theme to your Garage permanently for this account.",
          themeId: "aurora",
        },
        {
          rewardId: "paid-discount-20",
          kind: "one_payment_discount",
          weight: 35,
          label: "20% off one payment",
          termsSummary:
            "Reserves a one-time 20% discount for a single eligible payment (upgrade or renewal). Not automatic enrolment. Expires 30 days after claim (UTC).",
          discountPercent: 20,
        },
        {
          rewardId: "paid-pack-neon-7d",
          kind: "sound_pack_7d",
          weight: 20,
          label: "Neon spotlight pack (7 days)",
          termsSummary:
            "Highlights Neon Drive, Synthwave Drive, and Deep Bass Pulse for 7 days from claim (UTC). Does not replace your existing library access; theme and discount remain the primary paid-pool value.",
          packProfileIds: ["neon-drive", "synthwave-drive", "deep-bass-pulse"],
        },
      ],
    },
  },
};

let activeCampaignOverride: SoundSpinCampaignConfig | null = null;

/** Tests / ops: replace active campaign. Pass null to restore staging default. */
export function setActiveCampaignForTests(campaign: SoundSpinCampaignConfig | null): void {
  activeCampaignOverride = campaign;
}

export function getActiveCampaign(): SoundSpinCampaignConfig {
  return activeCampaignOverride ?? STAGING_SOUND_SPIN_CAMPAIGN;
}

/** Enable the staging campaign in-process (tests / local preview). */
export function enableStagingCampaignForTests(enabled = true): void {
  activeCampaignOverride = {
    ...STAGING_SOUND_SPIN_CAMPAIGN,
    enabled,
  };
}
