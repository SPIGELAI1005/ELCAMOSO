/**
 * Founders Pack (pre-launch promotion).
 *
 * Anyone who signs in with a verified email on or before Black Friday,
 * 27.11.2026 23:59:59 Europe/Berlin can claim one of 458 Founder seats
 * (`users.founder_at`). Founders keep the free engine sounds forever.
 *
 * Drive Unlimited (DRIVE_COMPLETE: Drive+ and Drive the Music):
 * - EXISTING Founders claimed before FOUNDER_PAID_UNLIMITED_CUTOVER keep access
 *   until 27.05.2027 23:59:59 Berlin (unchanged).
 * - NEW Founders get Drive Unlimited for 4 months only when they PURCHASE the
 *   Founders Pack, counted from the purchase date — not from a free seat claim.
 *   Stripe Price id lives in STRIPE_PRICE_FOUNDERS_PACK (placeholder until the
 *   owner creates the product). No price amount is invented here.
 */

import { addMonthsUtc } from "@/lib/billing/black-friday";

/** Black Friday 27.11.2026 23:59:59 Europe/Berlin (CET, UTC+1). */
export const FOUNDERS_SIGNUP_DEADLINE_ISO = "2026-11-27T23:59:59+01:00";
export const FOUNDERS_SIGNUP_DEADLINE_MS = Date.parse(FOUNDERS_SIGNUP_DEADLINE_ISO);

/** 27.05.2027 23:59:59 Europe/Berlin (CEST, UTC+2) — legacy Founder Drive Unlimited end. */
export const FOUNDER_DRIVE_PLUS_UNTIL_ISO = "2027-05-27T23:59:59+02:00";
export const FOUNDER_DRIVE_PLUS_UNTIL_MS = Date.parse(FOUNDER_DRIVE_PLUS_UNTIL_ISO);

/**
 * Founders whose `founder_at` is strictly before this instant keep Drive Unlimited
 * until 27.05.2027. Claims on/after this cutover do not receive that perk; they
 * get Drive Unlimited for 4 months only after a successful Founders Pack purchase.
 */
export const FOUNDER_PAID_UNLIMITED_CUTOVER_ISO = "2026-11-09T13:00:00+01:00";
export const FOUNDER_PAID_UNLIMITED_CUTOVER_MS = Date.parse(FOUNDER_PAID_UNLIMITED_CUTOVER_ISO);

/** Drive Unlimited length granted on a paid Founders Pack purchase. */
export const FOUNDER_PACK_UNLIMITED_MONTHS = 4;

/** Provenance label on entitlement grants written by a Founders Pack purchase. */
export const FOUNDERS_PACK_GRANT_SOURCE = "founders_pack";

/** Env holding the Stripe Price id. Empty until the owner creates the product — do not invent a price. */
export const STRIPE_PRICE_FOUNDERS_PACK_ENV = "STRIPE_PRICE_FOUNDERS_PACK";

/** Free engine profiles Founders keep forever. */
export { FREE_SOUND_PROFILE_IDS as FOUNDER_FOREVER_PROFILE_IDS } from "@/lib/sound/profile-access-config";

export interface FounderStatus {
  /** UTC epoch ms when the account became a Founder (seat claim). */
  since: number;
  /** UTC epoch ms when the Founder Drive Unlimited perk ends; 0 if none. */
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

/** True when this claim timestamp is a pre-cutover (legacy) Founder. */
export function isLegacyFounderClaim(founderAt: number | null | undefined): boolean {
  return founderAt != null && Number.isFinite(founderAt) && founderAt < FOUNDER_PAID_UNLIMITED_CUTOVER_MS;
}

/** Drive Unlimited expiry from a Founders Pack purchase timestamp. */
export function foundersPackUnlimitedUntilMs(purchasedAt: number): number {
  return addMonthsUtc(purchasedAt, FOUNDER_PACK_UNLIMITED_MONTHS);
}

/**
 * When Drive Unlimited from the Founders Pack ends.
 * Legacy claims: fixed 27.05.2027. New claims: 4 months from purchase, or none.
 */
export function founderDriveUnlimitedUntilMs(input: {
  founderAt: number | null | undefined;
  purchasedAt?: number | null;
}): number | null {
  if (isLegacyFounderClaim(input.founderAt)) return FOUNDER_DRIVE_PLUS_UNTIL_MS;
  if (input.purchasedAt != null && Number.isFinite(input.purchasedAt)) {
    return foundersPackUnlimitedUntilMs(input.purchasedAt);
  }
  return null;
}

export function founderStatusFrom(
  founderAt: number | null | undefined,
  purchasedAt: number | null | undefined = null,
): FounderStatus | null {
  if (founderAt == null || !Number.isFinite(founderAt)) return null;
  if (founderAt > FOUNDERS_SIGNUP_DEADLINE_MS) return null;
  const until = founderDriveUnlimitedUntilMs({ founderAt, purchasedAt });
  return { since: founderAt, drivePlusUntil: until ?? 0 };
}

/** Founder Drive Unlimited perk active at `now`. */
export function isFounderDrivePlusActive(
  founderAt: number | null | undefined,
  now = Date.now(),
  purchasedAt: number | null | undefined = null,
): boolean {
  const status = founderStatusFrom(founderAt, purchasedAt);
  return status != null && status.drivePlusUntil > 0 && now <= status.drivePlusUntil;
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

/** Marketing perks for new (paid) Founders Pack buyers. */
export const FOUNDER_PERKS = [
  "4 sounds free forever",
  "Drive Unlimited for 4 months when you buy the Founders Pack",
  "Founders Test Crew: new features first",
  "Exclusive Crew perks to follow",
] as const;

/** Perks line for a Founder who already holds a seat (legacy vs new). */
export function founderPerkLine(founderAt: number | null | undefined, language = "en"): string {
  const key = language.slice(0, 2).toLowerCase();
  if (isLegacyFounderClaim(founderAt)) {
    if (key === "de")
      return "3 Sounds für immer gratis · 6 Monate Drive+ gratis · Founders Test Crew: neue Features zuerst · Exklusive Crew-Vorteile folgen";
    if (key === "ro")
      return "3 sunete gratuite pentru totdeauna · 6 luni Drive+ gratuit · Founders Test Crew: functii noi primele · Beneficii exclusive Crew vor urma";
    return "3 sounds free forever · 6 months Drive+ free · Founders Test Crew: new features first · Exclusive Crew perks to follow";
  }
  if (key === "de")
    return "4 Sounds für immer gratis · Drive Unlimited für 4 Monate beim Kauf des Founders Pack · Founders Test Crew: neue Features zuerst · Exklusive Crew-Vorteile folgen";
  if (key === "ro")
    return "4 sunete gratuite pentru totdeauna · Drive Unlimited 4 luni la cumpărarea Founders Pack · Founders Test Crew: functii noi primele · Beneficii exclusive Crew vor urma";
  return "4 sounds free forever · Drive Unlimited for 4 months when you buy the Founders Pack · Founders Test Crew: new features first · Exclusive Crew perks to follow";
}

export const FOUNDERS_OFFER_COPY = {
  en: {
    compact: "Sign up before 27.11.",
    compactPerk: " · 4 mo Drive Unlimited when you buy",
    fullPerk:
      " Buying the Founders Pack gives Drive Unlimited for 4 months. 4 sounds free forever + Founders Test Crew.",
    claimTitle: "Claim your Founder seat",
    claimBody:
      "Sign in with your email before 27.11. to claim a Founder seat. Buying the Founders Pack gives Drive Unlimited for 4 months from the purchase date. Limited seats.",
    buy: "Buy Founders Pack",
    claim: "Claim it",
  },
  de: {
    compact: "Anmelden bis 27.11.",
    compactPerk: " · 4 Monate Drive Unlimited beim Kauf",
    fullPerk:
      " Der Kauf des Founders Pack gibt Drive Unlimited für 4 Monate. 4 Sounds für immer gratis + Founders Test Crew.",
    claimTitle: "Founder-Platz sichern",
    claimBody:
      "Melde dich bis 27.11. an, um einen Founder-Platz zu sichern. Der Kauf des Founders Pack gibt Drive Unlimited für 4 Monate ab Kaufdatum. Begrenzte Plätze.",
    buy: "Founders Pack kaufen",
    claim: "Sichern",
  },
  ro: {
    compact: "Inscrie-te pana pe 27.11.",
    compactPerk: " · 4 luni Drive Unlimited la cumparare",
    fullPerk:
      " Cumpararea Founders Pack ofera Drive Unlimited pentru 4 luni. 4 sunete gratuite pentru totdeauna + Founders Test Crew.",
    claimTitle: "Rezerva locul Founder",
    claimBody:
      "Conecteaza-te cu emailul inainte de 27.11. ca sa ocupi un loc Founder. Cumpararea Founders Pack ofera Drive Unlimited pentru 4 luni de la data achizitiei. Locuri limitate.",
    buy: "Cumpara Founders Pack",
    claim: "Rezerva",
  },
} as const;

export function foundersOfferCopy(language: string | undefined) {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? FOUNDERS_OFFER_COPY[key] : FOUNDERS_OFFER_COPY.en;
}
