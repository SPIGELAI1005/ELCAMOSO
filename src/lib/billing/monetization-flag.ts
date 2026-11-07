/** Master switch for checkout, upgrades, trials, and purchase UX. On unless set to 0, false, no, or off. */
export function isMonetizationEnabled(): boolean {
  const value = process.env.MONETIZATION_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === "") return true;
  return value === "1" || value === "true" || value === "yes" || value === "on";
}
