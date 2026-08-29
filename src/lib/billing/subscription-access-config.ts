/** Configurable grace after payment failure before Drive+ access ends. */
export interface SubscriptionAccessPolicyConfig {
  /** Milliseconds to retain Drive+ after `past_due` before downgrading. */
  pastDueGraceMs: number;
}

const DEFAULT_PAST_DUE_GRACE_DAYS = 7;

function readPastDueGraceDays(): number {
  const raw = process.env.DRIVE_PLUS_PAST_DUE_GRACE_DAYS;
  if (!raw) return DEFAULT_PAST_DUE_GRACE_DAYS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PAST_DUE_GRACE_DAYS;
  return parsed;
}

export function readSubscriptionAccessPolicyConfig(): SubscriptionAccessPolicyConfig {
  const days = readPastDueGraceDays();
  return {
    pastDueGraceMs: days * 24 * 60 * 60 * 1000,
  };
}
