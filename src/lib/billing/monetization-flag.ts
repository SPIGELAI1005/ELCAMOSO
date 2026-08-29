function readTruthyEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** Master switch for checkout, upgrades, trials, and purchase UX. Default: off. */
export function isMonetizationEnabled(): boolean {
  return readTruthyEnv("MONETIZATION_ENABLED");
}
