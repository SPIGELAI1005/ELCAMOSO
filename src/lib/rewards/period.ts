/**
 * Campaign period helpers.
 *
 * Sound Spin uses **UTC calendar month** boundaries exclusively.
 * Period key format: `YYYY-MM` (UTC).
 *
 * Example: claim at 2026-10-31T23:30:00.000Z → period `2026-10`
 *          claim at 2026-11-01T00:00:00.000Z → period `2026-11`
 */

export interface UtcMonthPeriod {
  /** `YYYY-MM` in UTC. */
  periodKey: string;
  /** Inclusive start: first instant of the UTC month. */
  startsAtUtc: number;
  /** Exclusive end: first instant of the next UTC month. */
  endsAtUtcExclusive: number;
  /** Last inclusive instant of the period (for UI "valid until"). */
  endsAtUtcInclusive: number;
}

export function utcMonthPeriodFromInstant(atMs: number = Date.now()): UtcMonthPeriod {
  const d = new Date(atMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-based
  const startsAtUtc = Date.UTC(year, month, 1, 0, 0, 0, 0);
  const endsAtUtcExclusive = Date.UTC(year, month + 1, 1, 0, 0, 0, 0);
  const periodKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    periodKey,
    startsAtUtc,
    endsAtUtcExclusive,
    endsAtUtcInclusive: endsAtUtcExclusive - 1,
  };
}

export function nextUtcMonthStart(atMs: number = Date.now()): number {
  return utcMonthPeriodFromInstant(atMs).endsAtUtcExclusive;
}

export function formatUtcIso(ms: number): string {
  return new Date(ms).toISOString();
}
