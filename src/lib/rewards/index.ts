export { isRewardsEnabled } from "./flag";
export { getActiveCampaign, STAGING_SOUND_SPIN_CAMPAIGN } from "./campaign-config";
export {
  claimSoundSpin,
  getSoundSpinStatus,
  getClaimForAccount,
  getAccountRewardExtras,
} from "./service";
export { resolveRewardAudience } from "./audience";
export {
  getRewardsPublicFlagFn,
  getSoundSpinStatusFn,
  claimSoundSpinFn,
  getSoundSpinClaimFn,
} from "./server-fns";
export type {
  SoundSpinPublicStatus,
  PublicClaimView,
  ClaimSoundSpinResult,
  RewardOutcomeKind,
  RewardAudience,
} from "./types";

export {
  isRewardDiscountsEnabled,
  getRewardDiscountTermsFn,
  previewRewardDiscountFn,
  applyRenewalRewardDiscountFn,
} from "./discount";
