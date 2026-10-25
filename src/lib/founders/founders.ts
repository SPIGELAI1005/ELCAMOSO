/**
 * Founders Pack (pre-launch promotion).
 *
 * Anyone who signs in with a verified email (email code / magic link / Google — every
 * ELCAMOSO sign-in proves email ownership) on or before 09.11.2026 23:59:59 Europe/Berlin
 * is stamped as a Founder (`users.founder_at`). Founders keep the 3 free engine sounds
 * forever (free for everyone today) and get full Drive+ until 09.05.2027 23:59:59 Berlin.
 */

/** 09.11.2026 23:59:59 Europe/Berlin (CET, UTC+1). */
export const FOUNDERS_SIGNUP_DEADLINE_ISO = "2026-11-09T23:59:59+01:00";
export const FOUNDERS_SIGNUP_DEADLINE_MS = Date.parse(FOUNDERS_SIGNUP_DEADLINE_ISO);

/** 09.05.2027 23:59:59 Europe/Berlin (CEST, UTC+2) — 6 months after the deadline. */
export const FOUNDER_DRIVE_PLUS_UNTIL_ISO = "2027-05-09T23:59:59+02:00";
export const FOUNDER_DRIVE_PLUS_UNTIL_MS = Date.parse(FOUNDER_DRIVE_PLUS_UNTIL_ISO);

/** Free engine profiles Founders keep forever. */
export { FREE_SOUND_PROFILE_IDS as FOUNDER_FOREVER_PROFILE_IDS } from "@/lib/sound/profile-access-config";

export interface FounderStatus {
  /** UTC epoch ms when the account became a Founder. */
  since: number;
  /** UTC epoch ms when the Founder Drive+ perk ends. */
  drivePlusUntil: number;
}

/** True while new Founders can still be minted. */
export function isFounderSignupOpen(now = Date.now()): boolean {
  return now <= FOUNDERS_SIGNUP_DEADLINE_MS;
}

/**
 * Eligibility: account created AND email confirmed on/before the deadline.
 * `confirmedAt` is the time of a verified sign-in.
 */
export function isFounderEligible(input: {
  createdAt: number | null | undefined;
  confirmedAt: number | null | undefined;
}): boolean {
  const { createdAt, confirmedAt } = input;
  if (createdAt == null || confirmedAt == null) return false;
  if (!Number.isFinite(createdAt) || !Number.isFinite(confirmedAt)) return false;
  return createdAt <= FOUNDERS_SIGNUP_DEADLINE_MS && confirmedAt <= FOUNDERS_SIGNUP_DEADLINE_MS;
}

export function founderStatusFrom(founderAt: number | null | undefined): FounderStatus | null {
  if (founderAt == null || !Number.isFinite(founderAt)) return null;
  if (founderAt > FOUNDERS_SIGNUP_DEADLINE_MS) return null;
  return { since: founderAt, drivePlusUntil: FOUNDER_DRIVE_PLUS_UNTIL_MS };
}

/** Founder Drive+ perk active at `now`. */
export function isFounderDrivePlusActive(
  founderAt: number | null | undefined,
  now = Date.now(),
): boolean {
  const status = founderStatusFrom(founderAt);
  return status != null && now <= status.drivePlusUntil;
}

/** Remaining ms until the signup deadline (0 after). */
export function msUntilFounderDeadline(now = Date.now()): number {
  return Math.max(0, FOUNDERS_SIGNUP_DEADLINE_MS - now);
}

export function splitCountdown(ms: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/** Max number of Founders (env FOUNDER_SEAT_LIMIT overrides, default 458). */
export const DEFAULT_FOUNDER_SEAT_LIMIT = 458;
export function founderSeatLimit(): number {
  const raw = typeof process !== "undefined" ? process.env?.["FOUNDER_SEAT_LIMIT"] : undefined;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FOUNDER_SEAT_LIMIT;
}

/** Whether a new Founder can be minted now given the current seat count. */
export function canMintFounder(seatsTaken: number, now = Date.now(), limit = founderSeatLimit()): boolean {
  return isFounderSignupOpen(now) && seatsTaken < limit;
}

export function seatsLeft(seatsTaken: number, limit = founderSeatLimit()): number {
  return Math.max(0, limit - seatsTaken);
}

export const FOUNDER_PERKS = [
  "3 sounds free forever",
  "6 months Drive+ free",
  "Founders Test Crew: new features first",
  "Exclusive Crew perks to follow",
] as const;
