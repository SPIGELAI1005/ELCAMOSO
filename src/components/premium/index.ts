export { PremiumBadge } from "@/components/premium/PremiumBadge";
export { UpgradePrompt, type UpgradePromptVariant } from "@/components/premium/UpgradePrompt";
export { TrialRemaining } from "@/components/premium/TrialRemaining";
export { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";

export {
  PREMIUM_CONTEXTS,
  entitlementForPremiumContext,
  getPremiumContext,
  type PremiumContext,
  type PremiumContextCopy,
} from "@/lib/premium/contexts";

export {
  dismissPremiumPrompt,
  isPremiumPromptDismissed,
  resetPremiumPromptDismissalsForTests,
} from "@/lib/premium/dismiss-store";
