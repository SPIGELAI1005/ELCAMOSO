function readTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Master switch for Sound Spin / monthly rewards.
 * Disabled by default until campaign configuration is complete.
 */
export function isRewardsEnabled(): boolean {
  return readTruthyEnv("ELCAMOSO_REWARDS_ENABLED");
}
