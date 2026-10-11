function readTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Stripe reward-discount fulfilment (Prompt 13).
 * Off by default until operator configures test-mode coupons and enables the flag.
 * Independent of ELCAMOSO_REWARDS_ENABLED (claiming) — both must be on for end-to-end.
 */
export function isRewardDiscountsEnabled(): boolean {
  return readTruthyEnv("ELCAMOSO_REWARD_DISCOUNTS_ENABLED");
}
