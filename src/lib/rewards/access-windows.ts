/**
 * Temporary access windows for Sound Spin rewards.
 * All times are UTC milliseconds since epoch.
 * v1: access starts at claim time for every temporary reward.
 */

export interface AccessWindow {
  startsAtUtc: number;
  endsAtUtc: number | null;
}

/** One sound for 48 hours from claim. */
export function sound48hWindow(claimAtUtc: number): AccessWindow {
  return {
    startsAtUtc: claimAtUtc,
    endsAtUtc: claimAtUtc + 48 * 60 * 60 * 1000,
  };
}

/** Sound pack for seven days from claim. */
export function soundPack7dWindow(claimAtUtc: number): AccessWindow {
  return {
    startsAtUtc: claimAtUtc,
    endsAtUtc: claimAtUtc + 7 * 24 * 60 * 60 * 1000,
  };
}

/**
 * Full-library weekend pass (precise rule, v1):
 * - Activates at claim time (UTC).
 * - Expires at 23:59:59.999 UTC on the Sunday of the UTC week that contains
 *   the claim if the claim falls on Friday, Saturday, or Sunday (UTC).
 * - If claimed Monday–Thursday (UTC), expires at 23:59:59.999 UTC on the
 *   *following* Sunday (so the pass covers the upcoming weekend).
 * - Hard cap: never longer than 96 hours from claim (safety).
 */
export function fullLibraryWeekendWindow(claimAtUtc: number): AccessWindow {
  const claim = new Date(claimAtUtc);
  const day = claim.getUTCDay(); // 0=Sun … 5=Fri, 6=Sat
  const isFriSatSun = day === 5 || day === 6 || day === 0;

  let sundayYear = claim.getUTCFullYear();
  let sundayMonth = claim.getUTCMonth();
  let sundayDate = claim.getUTCDate();

  if (isFriSatSun) {
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    const sunday = new Date(
      Date.UTC(sundayYear, sundayMonth, sundayDate + daysUntilSunday, 23, 59, 59, 999),
    );
    sundayYear = sunday.getUTCFullYear();
    sundayMonth = sunday.getUTCMonth();
    sundayDate = sunday.getUTCDate();
  } else {
    // Mon–Thu → following Sunday
    const daysUntilSunday = 7 - day;
    const sunday = new Date(
      Date.UTC(sundayYear, sundayMonth, sundayDate + daysUntilSunday, 23, 59, 59, 999),
    );
    sundayYear = sunday.getUTCFullYear();
    sundayMonth = sunday.getUTCMonth();
    sundayDate = sunday.getUTCDate();
  }

  let endsAtUtc = Date.UTC(sundayYear, sundayMonth, sundayDate, 23, 59, 59, 999);
  const cap = claimAtUtc + 96 * 60 * 60 * 1000;
  if (endsAtUtc > cap) endsAtUtc = cap;
  if (endsAtUtc < claimAtUtc) endsAtUtc = claimAtUtc;

  return { startsAtUtc: claimAtUtc, endsAtUtc };
}

/** Cockpit themes and discount reservations: no timed profile access. */
export function openEndedFromClaim(claimAtUtc: number): AccessWindow {
  return { startsAtUtc: claimAtUtc, endsAtUtc: null };
}
