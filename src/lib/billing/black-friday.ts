/**
 * Black Friday 2026 special (George, 2 Nov 2026).
 *
 * - Drive the Music yearly: 4-month free trial for checkouts started on or
 *   before Black Friday (Fri 27.11.2026 23:59:59 Europe/Berlin). After the trial
 *   the yearly price applies unless cancelled.
 * - Founders' offer (both packages) also runs until Black Friday — see founders.ts.
 *
 * Client-safe: no secrets, pure date math.
 */

/** Black Friday 2026, end of day Europe/Berlin (CET, UTC+1). */
export const BLACK_FRIDAY_END_ISO = "2026-11-27T23:59:59+01:00";
export const BLACK_FRIDAY_END_MS = Date.parse(BLACK_FRIDAY_END_ISO);
/** Short label for UI copy. */
export const BLACK_FRIDAY_LABEL = "27.11.";

/** Free trial length for Drive the Music during the Black Friday special. */
export const MUSIC_TRIAL_MONTHS = 4;

/** Whether new Drive the Music checkouts get the Black Friday free trial. */
export function isMusicTrialOfferActive(now = Date.now()): boolean {
  return now <= BLACK_FRIDAY_END_MS;
}

/** Add calendar months in UTC (clamps to the last day of shorter months). */
export function addMonthsUtc(fromMs: number, months: number): number {
  const d = new Date(fromMs);
  const day = d.getUTCDate();
  const target = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + months,
      1,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.getTime();
}

/** Stripe `subscription_data.trial_end` (unix seconds) for a checkout started at `now`. */
export function musicTrialEndUnix(now = Date.now()): number {
  return Math.floor(addMonthsUtc(now, MUSIC_TRIAL_MONTHS) / 1000);
}

export const MUSIC_TRIAL_COPY = `Black Friday: ${MUSIC_TRIAL_MONTHS} months free`;
